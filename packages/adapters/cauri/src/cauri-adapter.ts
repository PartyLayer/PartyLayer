/**
 * CauriRemoteAdapter — PartyLayer adapter for Cauri Wallet.
 *
 * Cauri is a passkey-based remote wallet: its CIP-103 gateway exposes
 * JSON-RPC over HTTPS and Server-Sent Events, and every wallet-changing
 * action drives a popup on the wallet UI for user approval.
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  AdapterEventName,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  LedgerApiParams,
  LedgerApiResult,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  Session,
  PersistedSession,
  CapabilityKey,
} from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toSignature,
  toTransactionHash,
  ledgerApiBodyToString,
  normalizeLedgerMethodUpper,
  CapabilityNotSupportedError,
  UserRejectedError,
  TransportError,
  mapUnknownErrorToPartyLayerError,
} from '@partylayer/core';

import {
  CauriRpcClient,
  type CauriConnectResult,
  type CauriIsConnectedResult,
  type CauriSignMessageResult,
} from './rpc';
import {
  openStream,
  waitForAccountsChanged,
  type StreamHandle,
  type TxChangedEvent,
  type StatusChangedEvent,
} from './stream';
import { openPlaceholderPopup, navigatePopup, waitForOpenerMessage } from './popup';

export interface CauriRemoteAdapterConfig {
  /** dApp gateway base URL, e.g. `https://api.devnet.cauri.cc`. */
  apiBase: string;
  /** Wallet UI base URL, e.g. `https://devnet.cauri.cc` — hosts /dapp/connect/* and /dapp/transaction/*. */
  walletUiBase: string;
  /** Display name shown in the PartyLayer picker. Defaults to "Cauri Wallet". */
  name?: string;
}

// Opener postMessage envelopes — must match openerBridge in cauri-wallet-web.
const MSG_CONNECT_SUCCESS = 'SPLICE_WALLET_IDP_AUTH_SUCCESS';
const MSG_CONNECT_REJECTED = 'SPLICE_WALLET_IDP_AUTH_REJECTED';
const MSG_TX_APPROVED = 'SPLICE_WALLET_TX_APPROVED';
const MSG_TX_REJECTED = 'SPLICE_WALLET_TX_REJECTED';
const MSG_SIGN_MESSAGE_APPROVED = 'SPLICE_WALLET_MSG_SIGN_APPROVED';
const MSG_SIGN_MESSAGE_REJECTED = 'SPLICE_WALLET_MSG_SIGN_REJECTED';

const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;
const TX_TIMEOUT_MS = 5 * 60 * 1000;
const SIGN_MESSAGE_TIMEOUT_MS = 5 * 60 * 1000;

export class CauriRemoteAdapter implements WalletAdapter {
  readonly walletId = toWalletId('cauri');
  readonly name: string;

  private readonly rpc: CauriRpcClient;
  private readonly walletUiBase: string;
  private readonly streams = new Map<string, StreamHandle>();
  private readonly listeners = new Map<AdapterEventName, Set<(payload: unknown) => void>>();

  constructor(cfg: CauriRemoteAdapterConfig) {
    this.rpc = new CauriRpcClient(cfg.apiBase.replace(/\/+$/, ''));
    this.walletUiBase = cfg.walletUiBase.replace(/\/+$/, '');
    this.name = cfg.name ?? 'Cauri Wallet';
  }

  getCapabilities(): CapabilityKey[] {
    return [
      'connect',
      'disconnect',
      'restore',
      'signMessage',
      'signTransaction',
      'submitTransaction',
      'ledgerApi',
      'events',
      'popup',
      'remoteSigner',
    ];
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true };
  }

  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    const popup = openPlaceholderPopup('cauriConnect');
    if (!popup) throw new TransportError('Popup blocked. Allow popups for this site and try again.');

    const accountsAbort = new AbortController();
    let sessionId: string | undefined;
    try {
      const result = await this.rpc.call<CauriConnectResult>('connect');
      if (!result.userUrl || !result.sessionToken) {
        throw new TransportError('Cauri gateway connect returned no userUrl/sessionToken');
      }

      sessionId = sessionIdFromUserUrl(result.userUrl);
      const sessionToken = result.sessionToken;

      // Subscribe BEFORE navigating so we don't miss the first accountsChanged.
      const stream = this.getOrOpenStream(sessionId, sessionToken, ctx);
      const accountsPromise = waitForAccountsChanged(
        stream.source,
        CONNECT_TIMEOUT_MS,
        anyAbort(ctx.abortSignal, accountsAbort.signal),
      );
      // Swallow the rejection while the popup is in front; we re-await below.
      accountsPromise.catch(() => undefined);

      navigatePopup(popup, `${this.walletUiBase}/dapp/connect/${encodeURIComponent(sessionId)}`);

      const approval = await waitForOpenerMessage<{ sessionId: string }>(
        (m) => m.type === MSG_CONNECT_SUCCESS && (m as { sessionId?: string }).sessionId === sessionId,
        (m) => m.type === MSG_CONNECT_REJECTED && (m as { sessionId?: string }).sessionId === sessionId,
        CONNECT_TIMEOUT_MS,
        ctx.abortSignal,
      );
      if (!approval) throw new UserRejectedError('connect', { walletId: this.walletId });

      const accounts = await accountsPromise;
      const primary = accounts.find((a) => a.primary) ?? accounts[0];
      if (!primary) throw new TransportError('Cauri gateway returned an empty accounts list');

      const partyId = toPartyId(primary.partyId);
      this.fire('connect', { partyId, sessionId });

      return {
        partyId,
        session: {
          partyId,
          network: ctx.network,
          origin: ctx.origin,
          createdAt: Date.now(),
          metadata: {
            cauriSessionId: sessionId,
            cauriSessionToken: sessionToken,
          },
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      accountsAbort.abort();
      if (sessionId) this.closeStream(sessionId);
      try { popup.close(); } catch { /* no-op */ }
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'popup',
      });
    }
  }

  async disconnect(ctx: AdapterContext, session: Session): Promise<void> {
    const sessionId = session.metadata?.cauriSessionId;
    const sessionToken = session.metadata?.cauriSessionToken;
    try {
      if (sessionToken) await this.rpc.call('disconnect', undefined, sessionToken);
    } catch (err) {
      ctx.logger.warn('Cauri: disconnect RPC failed (continuing)', err);
    } finally {
      if (sessionId) this.closeStream(sessionId);
      this.fire('disconnect', { sessionId });
    }
  }

  async restore(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    const sessionId = persisted.metadata?.cauriSessionId;
    const sessionToken = persisted.metadata?.cauriSessionToken;
    if (typeof sessionId !== 'string' || typeof sessionToken !== 'string') {
      return null;
    }

    try {
      const status = await this.rpc.call<CauriIsConnectedResult>('isConnected', undefined, sessionToken);
      if (!status.isConnected) return null;

      // Trust persisted.partyId over status.partyId — party changes surface
      // via the accountsChanged SSE listener, not through this probe.
      this.getOrOpenStream(sessionId, sessionToken, ctx);
      this.fire('connect', { partyId: persisted.partyId, sessionId });
      return persisted;
    } catch (err) {
      // Fail closed: a stale token here would 401 on the next real action.
      ctx.logger.warn('Cauri: restore probe failed, dropping persisted session', err);
      return null;
    }
  }

  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    const sessionToken = session.metadata?.cauriSessionToken;
    if (typeof sessionToken !== 'string') {
      throw new TransportError('Cauri: session is missing sessionToken metadata');
    }

    const popup = openPlaceholderPopup('cauriSignMessage');
    if (!popup) throw new TransportError('Popup blocked. Allow popups for this site and try again.');

    try {
      const prep = await this.rpc.call<CauriSignMessageResult>(
        'signMessage',
        { message: params.message },
        sessionToken,
      );
      if (!prep.userUrl || !prep.messageId) {
        throw new TransportError('Cauri gateway signMessage returned no userUrl/messageId');
      }

      const messageId = prep.messageId;
      navigatePopup(popup, prep.userUrl);

      const approval = await waitForOpenerMessage<{
        commandId: string;
        signature: string;
        keyFingerprint: string;
      }>(
        (m) =>
          m.type === MSG_SIGN_MESSAGE_APPROVED &&
          (m as { commandId?: string }).commandId === messageId,
        (m) =>
          m.type === MSG_SIGN_MESSAGE_REJECTED &&
          (m as { commandId?: string }).commandId === messageId,
        SIGN_MESSAGE_TIMEOUT_MS,
        ctx.abortSignal,
      );
      if (!approval) throw new UserRejectedError('signMessage', { walletId: this.walletId });

      return {
        signature: toSignature(approval.signature),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      try { popup.close(); } catch { /* no-op */ }
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'popup',
      });
    }
  }

  // Both transaction signing entry points collapse to prepareExecute → popup → executed
  // because the Cauri backend signs and submits atomically. Console does the
  // same for the same reason.

  async signTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    const receipt = await this.runPrepareExecute(ctx, session, params.tx);
    return {
      signedTx: { commandId: receipt.commandId, transactionId: receipt.transactionHash },
      transactionHash: receipt.transactionHash,
      partyId: session.partyId,
    };
  }

  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    // Accept either bare commands or the wrapper produced by signTransaction.
    const tx = (params.signedTx as { commands?: unknown })?.commands ?? params.signedTx;
    return await this.runPrepareExecute(ctx, session, tx);
  }

  private async runPrepareExecute(
    ctx: AdapterContext,
    session: Session,
    commandsLike: unknown,
  ): Promise<TxReceipt & { commandId: string }> {
    const sessionToken = session.metadata?.cauriSessionToken;
    if (!sessionToken) throw new TransportError('Cauri: session is missing sessionToken metadata');

    const wrapped = unwrapPrepareExecuteParams(commandsLike);
    const popup = openPlaceholderPopup('cauriTx');
    if (!popup) throw new TransportError('Popup blocked. Allow popups for this site and try again.');

    try {
      const prep = await this.rpc.call<{ userUrl: string }>('prepareExecute', wrapped, sessionToken);
      if (!prep.userUrl) throw new TransportError('Cauri gateway prepareExecute returned no userUrl');

      const commandId = sessionIdFromUserUrl(prep.userUrl);
      navigatePopup(popup, `${this.walletUiBase}/dapp/transaction/${encodeURIComponent(commandId)}`);

      const approval = await waitForOpenerMessage<{ commandId: string; transactionId: string }>(
        (m) => m.type === MSG_TX_APPROVED && (m as { commandId?: string }).commandId === commandId,
        (m) => m.type === MSG_TX_REJECTED && (m as { commandId?: string }).commandId === commandId,
        TX_TIMEOUT_MS,
        ctx.abortSignal,
      );
      if (!approval) throw new UserRejectedError('submitTransaction', { walletId: this.walletId });

      return {
        transactionHash: toTransactionHash(approval.transactionId),
        submittedAt: Date.now(),
        commandId,
        updateId: approval.transactionId,
      };
    } catch (err) {
      try { popup.close(); } catch { /* no-op */ }
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'popup',
      });
    }
  }

  async ledgerApi(
    _ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    const sessionToken = session.metadata?.cauriSessionToken;
    if (!sessionToken) throw new CapabilityNotSupportedError(this.walletId, 'ledgerApi');

    const result = await this.rpc.call<{ response: string }>(
      'ledgerApi',
      {
        requestMethod: normalizeLedgerMethodUpper(params.requestMethod),
        resource: params.resource,
        body: ledgerApiBodyToString(params.body),
      },
      sessionToken,
    );
    return { response: result.response };
  }

  on(event: AdapterEventName, handler: (payload: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private fire(event: AdapterEventName, payload: unknown): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      try { h(payload); } catch { /* listener errors are its own problem */ }
    }
  }

  private getOrOpenStream(sessionId: string, sessionToken: string, ctx: AdapterContext): StreamHandle {
    const existing = this.streams.get(sessionId);
    if (existing) return existing;
    const stream = openStream(this.rpc.apiBase, sessionToken, {
      onTxChanged: (ev: TxChangedEvent) => this.fire('txStatus', ev),
      onStatusChanged: (ev: StatusChangedEvent) => {
        if (ev.status === 'disconnected' || ev.status === 'expired') {
          this.fire('sessionExpired', { sessionId, reason: ev.reason });
          this.closeStream(sessionId);
        }
      },
      onError: () => {
        // Evict the broken entry so the next caller opens a fresh stream
        // instead of latching onto a dead auto-reconnecting one.
        this.streams.delete(sessionId);
        this.fire('error', { kind: 'sse', sessionId });
      },
    });
    ctx.logger.debug('Cauri: opened SSE stream', { sessionId });
    this.streams.set(sessionId, stream);
    return stream;
  }

  private closeStream(sessionId: string): void {
    const stream = this.streams.get(sessionId);
    if (!stream) return;
    stream.close();
    this.streams.delete(sessionId);
  }
}

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

/** Extract the last path segment from `{walletUiBase}/dapp/{connect|transaction}/{id}`. */
function sessionIdFromUserUrl(userUrl: string): string {
  const trimmed = userUrl.replace(/\/+$/, '');
  return trimmed.substring(trimmed.lastIndexOf('/') + 1);
}

/** Normalize `tx` to Cauri's prepareExecute params (accepts bare commands or an envelope). */
function unwrapPrepareExecuteParams(tx: unknown): Record<string, unknown> {
  if (Array.isArray(tx)) return { commands: tx };
  if (tx && typeof tx === 'object') {
    const t = tx as Record<string, unknown>;
    if (Array.isArray(t.commands)) {
      return {
        commands: t.commands,
        actAs: t.actAs,
        readAs: t.readAs,
        disclosedContracts: t.disclosedContracts,
        packageIdSelectionPreference: t.packageIdSelectionPreference,
      };
    }
  }
  return { commands: tx };
}

/** Merge two abort signals: emit `abort` when either does. */
function anyAbort(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  const merged = new AbortController();
  const onAbort = () => merged.abort();
  if (a.aborted || b.aborted) merged.abort();
  else {
    a.addEventListener('abort', onAbort, { once: true });
    b.addEventListener('abort', onAbort, { once: true });
  }
  return merged.signal;
}
