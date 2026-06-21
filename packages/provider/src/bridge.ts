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
  CIP0103TxStatus,
  CIP0103LedgerApiResponse,
} from '@partylayer/core';
import { CIP0103_EVENTS } from '@partylayer/core';
import { CIP0103EventBus } from './event-bus';
import { unsupportedMethod, disconnected } from './errors';
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
    transactionHash: unknown;
    signedTx?: unknown;
    partyId?: unknown;
  }>;
  submitTransaction(params: {
    signedTx: unknown;
  }): Promise<{
    transactionHash: unknown;
    submittedAt?: number;
    commandId?: string;
    updateId?: string;
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
        return toCAIP2Network(
          session?.network ?? 'devnet',
        ) satisfies CIP0103Network;
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
        const cmdId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        // 1. Emit 'pending'
        pendingEmitted.add(cmdId);
        eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, {
          status: 'pending',
          commandId: cmdId,
        } as CIP0103TxChangedEvent);

        // 2. Sign transaction
        try {
          const signResult = await client.signTransaction({ tx: p });

          // 3. Emit 'signed' with signature metadata
          const session = await client.getActiveSession();
          const partyId = String(signResult.partyId ?? session?.partyId ?? 'unknown');
          eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, {
            status: 'signed',
            commandId: cmdId,
            payload: {
              signature: String(signResult.transactionHash),
              signedBy: partyId,
              party: partyId,
            },
          } as CIP0103TxChangedEvent);

          // 4. Submit transaction
          try {
            const receipt = await client.submitTransaction({
              signedTx: signResult.signedTx ?? signResult.transactionHash,
            });

            // 5. Emit 'executed' with real receipt data
            pendingEmitted.delete(cmdId);
            eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, {
              status: 'executed',
              commandId: cmdId,
              payload: {
                updateId: receipt.updateId ?? receipt.commandId ?? String(receipt.transactionHash),
                completionOffset: 0,
              },
            } as CIP0103TxChangedEvent);
          } catch (submitErr) {
            pendingEmitted.delete(cmdId);
            eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, {
              status: 'failed',
              commandId: cmdId,
            } as CIP0103TxChangedEvent);
            throw submitErr;
          }
        } catch (signErr) {
          // Only emit 'failed' if not already emitted by submit catch above
          if (pendingEmitted.has(cmdId)) {
            pendingEmitted.delete(cmdId);
            eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, {
              status: 'failed',
              commandId: cmdId,
            } as CIP0103TxChangedEvent);
          }
          throw signErr;
        }

        return undefined;
      }

      case 'ledgerApi': {
        if (!client.ledgerApi) {
          throw unsupportedMethod('ledgerApi');
        }
        const p = normalizeParams(params);
        const result = await client.ledgerApi({
          requestMethod: String(p.requestMethod ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE',
          resource: String(p.resource ?? ''),
          body: p.body ? String(p.body) : undefined,
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
    const session = (e as { session: { partyId: unknown; network: string; expiresAt?: number } }).session;

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

  // tx:status → txChanged
  client.on('tx:status', (event: unknown) => {
    const e = event as {
      type: string;
      status: string;
      txId: unknown;
      raw?: unknown;
    };
    if (!e || typeof e !== 'object' || !('status' in e)) return;

    const statusMap: Record<string, CIP0103TxStatus> = {
      pending: 'pending',
      submitted: 'pending',
      signed: 'signed',
      committed: 'executed',
      rejected: 'failed',
      failed: 'failed',
    };

    const mappedStatus = statusMap[e.status] ?? 'pending';
    const commandId = String(e.txId);

    // Deduplicate: skip 'pending' if already emitted by prepareExecute handler
    if (mappedStatus === 'pending' && pendingEmitted.has(commandId)) {
      return;
    }

    // Clean up dedup tracking on terminal states
    if (mappedStatus === 'executed' || mappedStatus === 'failed') {
      pendingEmitted.delete(commandId);
    }

    // Build spec-compliant txChanged payload per CIP-0103 discriminated union
    let txEvent: CIP0103TxChangedEvent;
    switch (mappedStatus) {
      case 'signed':
        txEvent = {
          status: 'signed',
          commandId,
          payload: {
            signature: '',
            signedBy: '',
            party: '',
          },
        };
        break;
      case 'executed': {
        const raw = e.raw as { updateId?: string; commandId?: string } | undefined;
        txEvent = {
          status: 'executed',
          commandId,
          payload: {
            updateId: raw?.updateId ?? raw?.commandId ?? commandId,
            completionOffset: 0,
          },
        };
        break;
      }
      case 'failed':
        txEvent = { status: 'failed', commandId };
        break;
      default:
        txEvent = { status: 'pending', commandId };
        break;
    }

    eventBus.emit<CIP0103TxChangedEvent>(CIP0103_EVENTS.TX_CHANGED, txEvent);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  };
}
