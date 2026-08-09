/**
 * Wintip Wallet adapter implementation.
 *
 * Wintip is a web-hosted, CUSTODIAL Canton wallet (wallet.wintip.cc) — there
 * is no browser extension and no per-user signing key on the client. A dApp
 * includes `<script src="https://wallet.wintip.cc/wintip-provider.js">`,
 * which injects `window.canton` (a real CIP-0103 provider — request/on/emit/
 * removeListener) backed by a hidden, lazily-expanding iframe pointed at
 * Wintip's own `/bridge` page. Every RPC call is a postMessage round trip to
 * that iframe; the wallet itself decides when to show its approval UI (the
 * iframe expands into a visible overlay), not this adapter.
 *
 * Because the provider is *already* a live, ready-to-use CIP0103Provider by
 * the time detectInstalled()/connect() run, this adapter is much thinner
 * than Console's or Send's — no separate SDK package, no local/remote
 * target selection, no extension postMessage-channel plumbing to build.
 * It's closer in shape to a plain injected-provider wrapper, but kept as a
 * first-party adapter (rather than relying purely on the generic
 * GenericAnnounceAdapter/injected-provider discovery path) for two reasons:
 * accurate capability reporting (Wintip has no signMessage — the generic
 * adapter's baseline three capabilities can't omit it) and a properly
 * branded picker entry (name/icon) instead of a generic "Canton Wallet
 * (xxxxxx…)" placeholder.
 *
 * signMessage / signTransaction are intentionally NOT implemented (not just
 * declared unsupported): Wintip has no per-user key to sign with at all —
 * its own bridge already answers signMessage with CIP-0103 code 4200
 * (UNSUPPORTED_METHOD). Money-moving actions go through
 * prepareExecute/prepareExecuteAndWait (submitTransaction here), which
 * Wintip's backend executes on the user's behalf after its own PIN/passkey
 * approval — there is nothing for a client-side "sign" step to produce.
 */

import {
  toPartyId,
  toTransactionHash,
  toWalletId,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type AdapterEventName,
  type CapabilityKey,
  type CIP0103Provider,
  type LedgerApiParams,
  type LedgerApiResult,
  type PartyId,
  type PersistedSession,
  type Session,
  type SubmitTransactionParams,
  type TxReceipt,
  type WalletAdapter,
  isRecognizedNetwork,
  ledgerApiBodyToObject,
  normalizeLedgerMethodLower,
} from '@partylayer/core';

import { WINTIP_PROVIDER_ID, WINTIP_WALLET_ID } from './constants';
import { WintipNotInstalledError, mapWintipError } from './errors';
import type {
  WintipAccount,
  WintipEventListener,
  WintipPrepareExecuteResponse,
  WintipPrepareSubmissionRequest,
  WintipStatusEvent,
  WintipTxChangedEvent,
} from './types';

const WINTIP_CAPABILITIES: CapabilityKey[] = [
  'connect',
  'disconnect',
  'restore',
  'submitTransaction',
  'ledgerApi',
  'events',
  'injected',
];

/**
 * Locate Wintip's own injected provider. `window.wintipCantonProvider` is
 * set UNCONDITIONALLY by wintip-provider.js (unlike `window.canton`, which
 * it only claims if no other wallet got there first) — checking this
 * dedicated global first means this adapter finds Wintip Wallet reliably
 * even on a page where another wallet extension already owns the shared
 * `window.canton` slot. Falls back to `window.canton` (verified via
 * status().provider.id) for pages that only ever set the shared slot.
 */
function getWintipProvider(): CIP0103Provider | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    wintipCantonProvider?: CIP0103Provider;
    canton?: CIP0103Provider;
  };
  if (win.wintipCantonProvider) return win.wintipCantonProvider;
  return win.canton ?? null;
}

/** Confirms a discovered `window.canton` slot is actually Wintip's, not some other wallet's. */
async function isWintipsOwnProvider(provider: CIP0103Provider): Promise<boolean> {
  try {
    const status = await provider.request<WintipStatusEvent>({ method: 'status' });
    return status?.provider?.id === WINTIP_PROVIDER_ID;
  } catch {
    return false;
  }
}

function mapTxStatus(
  status: WintipTxChangedEvent['status'],
): 'pending' | 'submitted' | 'committed' | 'failed' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'executed':
      return 'committed';
    case 'failed':
    default:
      return 'failed';
  }
}

/** Packs diagnostic fields into Session.metadata (must all be strings — omit anything missing). */
function buildSessionMetadata(account: WintipAccount): Record<string, string> {
  const meta: Record<string, string> = {
    signingProviderId: account.signingProviderId,
    namespace: account.namespace,
    networkId: account.networkId,
    hint: account.hint,
  };
  return meta;
}

export class WintipAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WINTIP_WALLET_ID);
  readonly name = 'Wintip Wallet';

  getCapabilities(): CapabilityKey[] {
    return WINTIP_CAPABILITIES;
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }
    const provider = getWintipProvider();
    if (!provider) {
      return {
        installed: false,
        reason: 'Wintip Wallet connector not detected on this page',
      };
    }
    // window.wintipCantonProvider (if present) IS always Wintip's — no
    // ambiguity to resolve. Only the window.canton fallback needs the
    // identity probe (another wallet may own that shared slot).
    const win = window as unknown as { wintipCantonProvider?: CIP0103Provider };
    if (win.wintipCantonProvider) {
      return { installed: true, reason: 'Wintip Wallet connector detected' };
    }
    const isWintip = await isWintipsOwnProvider(provider);
    return isWintip
      ? { installed: true, reason: 'Wintip Wallet connector detected' }
      : { installed: false, reason: 'window.canton is owned by a different wallet' };
  }

  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId },
  ): Promise<AdapterConnectResult> {
    try {
      const provider = getWintipProvider();
      if (!provider) throw new WintipNotInstalledError();

      ctx.logger.debug('Connecting to Wintip Wallet', {
        appName: ctx.appName,
        origin: ctx.origin,
        network: ctx.network,
      });

      const connectResult = await provider.request<{ isConnected: boolean; reason?: string }>({
        method: 'connect',
      });
      if (!connectResult.isConnected) {
        throw new Error(connectResult.reason || 'Wintip Wallet connection was rejected');
      }

      const account = await provider.request<WintipAccount>({ method: 'getPrimaryAccount' });
      const partyId = toPartyId(account.partyId);

      // Wallet-reported network (truthful) → account → dApp config, trusting
      // only a RECOGNIZED CAIP-2 value (mirrors Console/Send: an
      // unrecognized report must not override ctx.network).
      let reportedNetwork: string | undefined;
      try {
        const status = await provider.request<WintipStatusEvent>({ method: 'status' });
        reportedNetwork = status?.network?.networkId;
      } catch {
        // status is best-effort — fall through to account/config.
      }
      const network =
        [reportedNetwork, account.networkId, ctx.network].find(
          (n): n is string => typeof n === 'string' && isRecognizedNetwork(n),
        ) ?? ctx.network;

      ctx.logger.info('Connected to Wintip Wallet', {
        partyId: account.partyId,
        network,
      });

      return {
        partyId,
        session: {
          walletId: this.walletId,
          network,
          createdAt: Date.now(),
          metadata: buildSessionMetadata(account),
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapWintipError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'injected',
        details: { origin: ctx.origin, network: ctx.network },
      });
    }
  }

  async disconnect(ctx: AdapterContext, _session: Session): Promise<void> {
    try {
      const provider = getWintipProvider();
      if (provider) await provider.request({ method: 'disconnect' });
    } catch (err) {
      ctx.logger.warn('Error during Wintip Wallet disconnect', err);
    }
  }

  /**
   * Silent probe on page reload — status()/getPrimaryAccount() show no UI
   * (no popup, no PIN prompt), so this is safe to call unconditionally.
   */
  async restore(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    try {
      if (typeof window === 'undefined') return null;
      const provider = getWintipProvider();
      if (!provider) return null;
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;

      const connStatus = await provider.request<{ isConnected: boolean }>({
        method: 'isConnected',
      });
      if (!connStatus?.isConnected) return null;

      const account = await provider.request<WintipAccount>({ method: 'getPrimaryAccount' });
      if (account.partyId !== persisted.partyId) {
        ctx.logger.debug('Wintip primary account changed since session was persisted; treating as expired', {
          persistedPartyId: persisted.partyId,
          currentPartyId: account.partyId,
        });
        return null;
      }

      return {
        ...persisted,
        walletId: this.walletId,
        metadata: { ...(persisted.metadata ?? {}), ...buildSessionMetadata(account) },
      };
    } catch (err) {
      ctx.logger.warn('Failed to restore Wintip Wallet session', err);
      return null;
    }
  }

  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    const payload = params.signedTx as WintipPrepareSubmissionRequest;
    try {
      const provider = getWintipProvider();
      if (!provider) throw new WintipNotInstalledError();

      if (!payload || typeof payload !== 'object') {
        throw new Error(
          'submitTransaction requires a JsPrepareSubmissionRequest as `signedTx`',
        );
      }
      if (!Array.isArray(payload.commands) || payload.commands.length === 0) {
        throw new Error(
          "submitTransaction signedTx is missing or has an empty 'commands' array",
        );
      }

      ctx.logger.debug('Submitting transaction via Wintip Wallet', {
        sessionId: session.sessionId,
        commandId: payload.commandId,
      });

      const result = await provider.request<WintipPrepareExecuteResponse>({
        method: 'prepareExecuteAndWait',
        // WintipPrepareSubmissionRequest is a known-shape interface, not an
        // index-signature type — CIP0103RequestParams only accepts unknown[]
        // or Record<string, unknown>. Structurally identical at runtime
        // (it's just a plain object of JSON-serializable fields).
        params: payload as unknown as Record<string, unknown>,
      });

      // Read flat first (Wintip's real current shape), payload-nested as a
      // fallback (canonical CIP0103TxExecutedPayload shape) — see types.ts.
      const updateId = result?.tx?.updateId ?? result?.tx?.payload?.updateId;

      if (!result?.tx || result.tx.status !== 'executed' || !updateId) {
        throw new Error(
          'Wintip Wallet returned an unexpected shape from prepareExecuteAndWait. ' +
            `Expected { tx: { status: 'executed', updateId, ... } } but received ${JSON.stringify(result)}.`,
        );
      }

      return {
        transactionHash: toTransactionHash(updateId),
        submittedAt: Date.now(),
        commandId: result.tx.commandId,
        updateId,
      };
    } catch (err) {
      throw mapWintipError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'injected',
        details: { sessionId: session.sessionId, commandId: payload?.commandId },
      });
    }
  }

  async ledgerApi(
    ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    try {
      const provider = getWintipProvider();
      if (!provider) throw new WintipNotInstalledError();

      ctx.logger.debug('Proxying ledger API request via Wintip Wallet', {
        sessionId: session.sessionId,
        requestMethod: params.requestMethod,
        resource: params.resource,
      });

      const result = await provider.request<{ status: number; data: unknown }>({
        method: 'ledgerApi',
        params: {
          requestMethod: normalizeLedgerMethodLower(params.requestMethod),
          resource: params.resource,
          body: ledgerApiBodyToObject(params.body),
        },
      });

      return { response: JSON.stringify(result?.data ?? null) };
    } catch (err) {
      throw mapWintipError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'injected',
        details: { sessionId: session.sessionId, requestMethod: params.requestMethod, resource: params.resource },
      });
    }
  }

  /** Bridges Wintip's native `txChanged` event → PartyLayer's `txStatus`. */
  on(event: AdapterEventName, handler: (payload: unknown) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    if (event !== 'txStatus') return () => {};
    const provider = getWintipProvider();
    if (!provider) return () => {};

    const listener: WintipEventListener = (...args: unknown[]) => {
      const tx = args[0] as WintipTxChangedEvent | undefined;
      if (!tx) return;
      handler({ status: mapTxStatus(tx.status), commandId: tx.commandId, raw: tx });
    };
    try {
      provider.on('txChanged', listener);
    } catch {
      return () => {
        /* provider unavailable — nothing to unsubscribe */
      };
    }
    return () => provider.removeListener('txChanged', listener);
  }
}
