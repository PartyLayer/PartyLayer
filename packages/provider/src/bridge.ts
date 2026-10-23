/**
 * PartyLayerClient → CIP-0103 Provider Bridge
 *
 * Creates a CIP-0103-compliant Provider backed by an existing
 * PartyLayerClient instance. This is the backward-compatibility path:
 * existing dApps using PartyLayerClient can obtain a standard Provider
 * without rewiring their wallet adapter stack.
 *
 * Usage:
 *   const provider = createProviderBridge(client);
 *   // or (added to PartyLayerClient):
 *   const provider = client.asProvider();
 */

import type {
  CIP0103Provider,
  CIP0103RequestPayload,
  CIP0103RequestParams,
  CIP0103EventListener,
  CIP0103ConnectResult,
  CIP0103StatusEvent,
  CIP0103Account,
  CIP0103Network,
  CIP0103TxChangedEvent,
  CIP0103LedgerApiResponse,
  LedgerApiMethod,
} from '@partylayer/core';
import { CIP0103_EVENTS } from '@partylayer/core';
import { CIP0103EventBus } from './event-bus';
import { unsupportedMethod, disconnected, resourceUnavailable } from './errors';
import { toProviderRpcError } from './error-map';
import { toCAIP2Network } from './network';

/** Injected at build time by tsup from package.json version */
declare const __PROVIDER_VERSION__: string;
const PROVIDER_VERSION = typeof __PROVIDER_VERSION__ !== 'undefined'
  ? __PROVIDER_VERSION__
  : '0.1.0';

// ─── Bridge Client Interface ────────────────────────────────────────────────

/**
 * Minimal interface for the PartyLayerClient consumed by the bridge.
 * Using an interface avoids importing the full SDK (prevents circular deps).
 */
export interface BridgeableClient {
  connect(options?: unknown): Promise<{
    sessionId: unknown;
    walletId: unknown;
    partyId: unknown;
    network: string;
    expiresAt?: number;
    capabilitiesSnapshot?: string[];
  }>;
  disconnect(): Promise<void>;
  getActiveSession(): Promise<{
    sessionId: unknown;
    walletId: unknown;
    partyId: unknown;
    network: string;
    expiresAt?: number;
    capabilitiesSnapshot?: string[];
  } | null>;
  signMessage(params: {
    message: string;
    nonce?: string;
    domain?: string;
  }): Promise<{ signature: unknown }>;
  signTransaction(params: { tx: unknown }): Promise<{
    // Optional: an adapter whose wallet reports no hash omits it rather than
    // inventing one. See TxReceipt.transactionHash in @partylayer/core.
    transactionHash?: unknown;
    signedTx?: unknown;
    partyId?: unknown;
    /** Actual signature metadata, never a transaction hash. */
    signature?: unknown;
    signedBy?: unknown;
  }>;
  submitTransaction(params: {
    signedTx: unknown;
  }): Promise<{
    transactionHash?: unknown;
    submittedAt?: number;
    commandId?: string;
    updateId?: string;
    completionOffset?: number;
  }>;
  ledgerApi?(params: {
    requestMethod: string;
    resource: string;
    body?: string | Record<string, unknown>;
  }): Promise<{ response: string }>;
  getRegistryStatus(): unknown;
  on(event: string, handler: (event: unknown) => void | Promise<void>): () => void;
}

// ─── Bridge Factory ─────────────────────────────────────────────────────────

/**
 * Create a CIP-0103 Provider backed by a PartyLayerClient.
 *
 * All `request()` calls are mapped to PartyLayerClient methods.
 * PartyLayer events are forwarded as CIP-0103 events.
 */
export function createProviderBridge(client: BridgeableClient): CIP0103Provider {
  const eventBus = new CIP0103EventBus();
  // Track commandIds that already emitted 'pending' to avoid double-emission
  const pendingEmitted = new Set<string>();

  const bridge: CIP0103Provider = {
    async request<T>(args: CIP0103RequestPayload): Promise<T> {
      return handleRequest(client, args, eventBus, pendingEmitted) as Promise<T>;
    },
    on<T>(event: string, listener: CIP0103EventListener<T>): CIP0103Provider {
      eventBus.on(event, listener);
      return bridge;
    },
    emit<T>(event: string, ...args: T[]): boolean {
      return eventBus.emit(event, ...args);
    },
    removeListener<T>(
      event: string,
      listener: CIP0103EventListener<T>,
    ): CIP0103Provider {
      eventBus.removeListener(event, listener);
      return bridge;
    },
  };

  eventBus.setOwner(bridge);
  wireEvents(client, eventBus, pendingEmitted);

  return bridge;
}

// ─── Request Handler ────────────────────────────────────────────────────────

async function handleRequest(
  client: BridgeableClient,
  args: CIP0103RequestPayload,
  eventBus: CIP0103EventBus,
  pendingEmitted: Set<string>,
): Promise<unknown> {
  const { method, params } = args;

  try {
    switch (method) {
      case 'connect': {
        await client.connect();
        return {
          isConnected: true,
        } satisfies CIP0103ConnectResult;
      }

      case 'disconnect': {
        await client.disconnect();
        return undefined;
      }

      case 'isConnected': {
        const session = await client.getActiveSession();
        return {
          isConnected: session !== null,
          reason: session ? undefined : 'No active session',
        } satisfies CIP0103ConnectResult;
      }

      case 'status': {
        const session = await client.getActiveSession();
        return {
          connection: {
            isConnected: session !== null,
          },
          provider: {
            id: 'partylayer',
            version: PROVIDER_VERSION,
            providerType: 'browser',
          },
          network: session
            ? toCAIP2Network(session.network)
            : undefined,
          session: session
            ? {
                accessToken: '',
                userId: String(session.partyId),
              }
            : undefined,
        } satisfies CIP0103StatusEvent;
      }

      case 'getActiveNetwork': {
        const session = await client.getActiveSession();
        if (!session) throw disconnected('No active session');
        return toCAIP2Network(session.network) satisfies CIP0103Network;
      }

      case 'listAccounts': {
        const session = await client.getActiveSession();
        if (!session) return [] as CIP0103Account[];
        return [
          sessionToAccount(session),
        ] satisfies CIP0103Account[];
      }

      case 'getPrimaryAccount': {
        const session = await client.getActiveSession();
        if (!session) throw disconnected('No active session');
        return sessionToAccount(session) satisfies CIP0103Account;
      }

      case 'signMessage': {
        const p = normalizeParams(params);
        const result = await client.signMessage({
          message: String(p.message ?? ''),
          nonce: p.nonce ? String(p.nonce) : undefined,
          domain: p.domain ? String(p.domain) : undefined,
        });
        return String(result.signature);
      }

      case 'prepareExecute': {
        const p = normalizeParams(params);
        const session = await client.getActiveSession();
        if (!session) throw disconnected('No active session');
        const cmdId = nonempty(p.commandId) ? p.commandId : `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        if (pendingEmitted.has(cmdId)) throw resourceUnavailable('This commandId is already pending');
        const payload = { ...p, commandId: cmdId };
        // This is the request's correlation id, not a fabricated ledger update.
        pendingEmitted.add(cmdId);
        eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, { status: 'pending', commandId: cmdId });
        let submitting = false;
        try {
          let signedTx: unknown = payload;
          // Missing capability snapshots retain compatibility with older clients.
          // A known combined-only wallet must never receive signTransaction first.
          if (!session.capabilitiesSnapshot || session.capabilitiesSnapshot.includes('signTransaction')) {
            const signed = await client.signTransaction({ tx: payload });
            if (signed.partyId !== undefined && signed.partyId !== session.partyId) {
              throw disconnected('Wallet account changed during signing');
            }
            signedTx = signed.signedTx;
            if (signedTx === undefined) throw new Error('Wallet returned no signed transaction');
            const event = signedEvent({ signature: signed.signature, signedBy: signed.signedBy, party: signed.partyId }, cmdId);
            if (event) eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, event);
          }
          const current = await client.getActiveSession();
          if (!current || current.sessionId !== session.sessionId || current.partyId !== session.partyId || current.network !== session.network) {
            throw disconnected('Wallet session changed before submission');
          }
          submitting = true;
          const receipt = await client.submitTransaction({ signedTx });
          const event = executedEvent(receipt, cmdId);
          // Acknowledgement or updateId without an actual completion offset cannot
          // become a complete CIP-0103 executed event. Never synthesize one.
          if (event) eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, event);
        } catch (reason) {
          const code = (reason as { code?: unknown } | null)?.code;
          // A lost submit response has an unknown ledger outcome. Only a failure
          // before the write, or explicit user rejection, establishes failure here.
          if (!submitting || code === 4001 || code === 'USER_REJECTED') {
            eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, { status: 'failed', commandId: cmdId });
          }
          throw reason;
        } finally { pendingEmitted.delete(cmdId); }
        return undefined;
      }

      case 'ledgerApi': {
        if (!client.ledgerApi) {
          throw unsupportedMethod('ledgerApi');
        }
        const p = normalizeParams(params);
        const result = await client.ledgerApi({
          // Forward the verb case AND the body type (string OR object) UNCHANGED;
          // the active wallet's adapter normalizes to its required shape
          // (lower+object for CIP-0103, string for Loop/Bron). Do NOT String()
          // the body — that would turn an object into "[object Object]".
          requestMethod: String(p.requestMethod ?? 'get') as LedgerApiMethod,
          resource: String(p.resource ?? ''),
          body: (p.body ?? undefined) as string | Record<string, unknown> | undefined,
        });
        return result satisfies CIP0103LedgerApiResponse;
      }

      default:
        throw unsupportedMethod(method);
    }
  } catch (err) {
    throw toProviderRpcError(err);
  }
}

// ─── Event Wiring ───────────────────────────────────────────────────────────

/**
 * Wire PartyLayer SDK events to CIP-0103 events.
 *
 * Direction: PartyLayerClient → CIP-0103 Provider (one-way only).
 * The bridge does NOT inject CIP-0103 events back into the client,
 * preventing circular event loops.
 */
function wireEvents(
  client: BridgeableClient,
  eventBus: CIP0103EventBus,
  pendingEmitted: Set<string>,
): void {
  // session:connected → statusChanged + accountsChanged
  client.on('session:connected', (event: unknown) => {
    const e = event as { type: string; session: BridgeableClient extends { getActiveSession(): Promise<infer S> } ? NonNullable<S> : never };
    if (!e || typeof e !== 'object' || !('session' in e)) return;
    const session = (e as { session: { partyId: unknown; network: string; expiresAt?: number; hasPreapproval?: boolean; utilityPreapprovalAdmins?: string[] } }).session;

    eventBus.emit(CIP0103_EVENTS.STATUS_CHANGED, {
      connection: { isConnected: true },
      provider: {
        id: 'partylayer',
        version: PROVIDER_VERSION,
        providerType: 'browser',
      },
      network: toCAIP2Network(session.network),
      session: {
        accessToken: '',
        userId: String(session.partyId),
      },
    } satisfies CIP0103StatusEvent);

    eventBus.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [
      {
        primary: true,
        partyId: String(session.partyId),
        status: 'allocated' as const,
        hint: '',
        publicKey: '',
        namespace: '',
        networkId: toCAIP2Network(session.network).networkId,
        signingProviderId: '',
        // Fund-safety passthrough, present only when the wallet reported it.
        hasPreapproval: session.hasPreapproval,
        utilityPreapprovalAdmins: session.utilityPreapprovalAdmins,
      },
    ] satisfies CIP0103Account[]);

    // Emit CIP-0103 'connected' event (async wallet completion signal)
    eventBus.emit(CIP0103_EVENTS.CONNECTED, {
      isConnected: true,
    } satisfies CIP0103ConnectResult);
  });

  // session:disconnected → statusChanged
  client.on('session:disconnected', () => {
    eventBus.emit(CIP0103_EVENTS.STATUS_CHANGED, {
      connection: { isConnected: false },
      provider: {
        id: 'partylayer',
        version: PROVIDER_VERSION,
        providerType: 'browser',
      },
    } satisfies CIP0103StatusEvent);
  });

  // Forward only states with the real fields required by the CIP-0103 union.
  client.on('tx:status', (event: unknown) => {
    const e = record(event);
    if (!e) return;
    const raw = record(e.raw);
    const tx = record(raw?.tx) ?? raw;
    const commandId = nonempty(tx?.commandId) ? tx.commandId : e.txId;
    if (!nonempty(commandId)) return;
    let txEvent: CIP0103TxChangedEvent | null;
    switch (e.status) {
      case 'pending':
      case 'submitted':
        if (pendingEmitted.has(commandId)) return;
        txEvent = { status: 'pending', commandId };
        break;
      case 'signed': txEvent = signedEvent(tx, commandId); break;
      case 'committed': txEvent = executedEvent(tx, commandId); break;
      case 'rejected':
      case 'failed': txEvent = { status: 'failed', commandId }; break;
      default: return;
    }
    if (txEvent) eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, txEvent);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function signedEvent(value: unknown, commandId: string): CIP0103TxChangedEvent | null {
  const tx = record(value);
  const p = record(tx?.payload) ?? tx;
  return nonempty(p?.signature) && nonempty(p?.signedBy) && nonempty(p?.party)
    ? { status: 'signed', commandId, payload: { signature: p.signature, signedBy: p.signedBy, party: p.party } } : null;
}
function executedEvent(value: unknown, commandId: string): CIP0103TxChangedEvent | null {
  const tx = record(value);
  const p = record(tx?.payload) ?? tx;
  return nonempty(p?.updateId) && typeof p.completionOffset === 'number' &&
    Number.isSafeInteger(p.completionOffset) && p.completionOffset >= 0
    ? { status: 'executed', commandId, payload: { updateId: p.updateId, completionOffset: p.completionOffset } } : null;
}

function normalizeParams(
  params?: CIP0103RequestParams,
): Record<string, unknown> {
  if (!params) return {};
  if (Array.isArray(params)) return (params[0] as Record<string, unknown>) ?? {};
  return params;
}

function sessionToAccount(session: {
  partyId: unknown;
  network: string;
  hasPreapproval?: boolean;
  utilityPreapprovalAdmins?: string[];
}): CIP0103Account {
  return {
    primary: true,
    partyId: String(session.partyId),
    status: 'allocated',
    hint: '',
    publicKey: '',
    namespace: '',
    networkId: toCAIP2Network(session.network).networkId,
    signingProviderId: '',
    // Fund-safety passthrough, present only when the wallet reported it.
    hasPreapproval: session.hasPreapproval,
    utilityPreapprovalAdmins: session.utilityPreapprovalAdmins,
  };
}
