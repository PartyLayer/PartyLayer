/**
 * Send Canton Wallet adapter.
 *
 * Send is a passkey-based Canton wallet that exposes the splice-wallet-kernel
 * OpenRPC protocol at `window.canton`. Because the bare `window.canton` slot is shared with
 * other splice-spec wallets (e.g. Console-class), the adapter funnels
 * every request through `SendProvider.guardedRequest`, which verifies
 * the running provider's `kernel.id` matches Send's Chrome extension
 * ID before forwarding the call.
 *
 * Capability summary: connect / disconnect / restore / signMessage /
 * submitTransaction / ledgerApi / events / injected. `signTransaction`
 * is intentionally NOT declared — Send (like Loop and Nightly) fuses
 * sign-and-submit through `prepareExecute*`, so a standalone sign step
 * would only mislead callers.
 */

import {
  CapabilityNotSupportedError,
  TransportError,
  normalizeLedgerMethodLower,
  ledgerApiBodyToObject,
  toPartyId,
  toSignature,
  toTransactionHash,
  toWalletId,
  type ProviderDetection,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type AdapterEventName,
  type CapabilityKey,
  type LedgerApiParams,
  type LedgerApiResult,
  type PartyId,
  type PersistedSession,
  type Session,
  type SignMessageParams,
  type SignTransactionParams,
  type SignedMessage,
  type SignedTransaction,
  type SubmitTransactionParams,
  type TxReceipt,
  type WalletAdapter,
} from '@partylayer/core';

import {
  SEND_INSTALL_URL,
  SEND_SIGNING_METHOD,
} from './constants';
import {
  SendNotInstalledError,
  isSendRpcError,
  mapSigilryError,
  safePreview,
  templateIdHint,
} from './errors';
import { SendProvider } from './send-provider';
import type {
  SendAccount,
  SendEventListener,
  SendPrepareSubmissionRequest,
  SendStatusResponse,
  SendTxChangedEvent,
} from './types';

const WALLET_ID = 'send';

const SEND_CAPABILITIES: CapabilityKey[] = [
  'connect',
  'disconnect',
  'restore',
  'signMessage',
  'submitTransaction',
  'ledgerApi',
  'events',
  'injected',
];

export class SendAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLET_ID);
  readonly name = 'Send';

  private readonly provider: SendProvider;

  /**
   * @param options.detection Optional. When supplied, the adapter uses
   *   these matcher rules to decide whether the running `window.canton`
   *   belongs to Send. Inject this from the registry entry's
   *   `providerDetection` field for canonical behaviour. Omitting it
   *   falls back to the built-in pattern that mirrors the canonical
   *   registry rule (parity is verified by tests).
   * @param options.provider Optional. Pre-built provider instance, used
   *   primarily by tests; takes precedence over `options.detection`.
   */
  constructor(options?: { detection?: ProviderDetection; provider?: SendProvider }) {
    this.provider = options?.provider ?? new SendProvider(options?.detection);
  }

  getCapabilities(): CapabilityKey[] {
    return SEND_CAPABILITIES;
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }
    if (!this.provider.isPotentiallyAvailable()) {
      return {
        installed: false,
        reason: `Send Canton Wallet not detected. Visit ${SEND_INSTALL_URL} for installation instructions`,
      };
    }
    // Installed iff Send advertises via canton:announceProvider — independent
    // of who owns the shared window.canton slot (e.g. Console).
    const installed = await this.provider.isInstalled();
    if (installed) {
      return { installed: true, reason: 'Send Canton Wallet detected' };
    }
    return {
      installed: false,
      reason: `Send Canton Wallet did not announce (canton:announceProvider). Visit ${SEND_INSTALL_URL} for installation instructions`,
    };
  }

  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number; partyId?: PartyId; preferInstalled?: boolean },
  ): Promise<AdapterConnectResult> {
    try {
      if (!this.provider.isPotentiallyAvailable()) {
        throw new SendNotInstalledError();
      }

      ctx.logger.debug('Connecting to Send Canton Wallet', {
        appName: ctx.appName,
        network: ctx.network,
      });

      const status = await this.provider.connect();
      const account = await this.provider.getPrimaryAccount();
      const partyId = toPartyId(account.partyId);

      ctx.logger.info('Connected to Send Canton Wallet', {
        partyId: account.partyId,
        signingProviderId: account.signingProviderId,
        kernelId: status.kernel?.id,
      });

      return {
        partyId,
        session: {
          walletId: this.walletId,
          // The wallet's EFFECTIVE network (so the client can detect a
          // mismatch with the dApp's configured network). Prefer what the
          // wallet reports; fall back to ctx.network only when absent.
          network: status.network?.networkId ?? account.networkId ?? ctx.network,
          createdAt: Date.now(),
          metadata: buildSessionMetadata(status, account),
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapSigilryError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'injected',
        details: { origin: ctx.origin, network: ctx.network },
      });
    }
  }

  async disconnect(ctx: AdapterContext, _session: Session): Promise<void> {
    try {
      await this.provider.disconnect();
    } catch (err) {
      ctx.logger.warn('Error during Send wallet disconnect', err);
    }
  }

  async restore(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    try {
      if (typeof window === 'undefined') return null;
      if (!this.provider.isPotentiallyAvailable()) return null;
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;

      // status() is a silent introspection call — no popup, no passkey
      // prompt — so we can use it as a "still authorised?" probe on page
      // reload. If the kernel.id has shifted (user installed another
      // wallet) the guarded request will throw `SendKernelMismatchError`
      // and we'll return null below.
      const status = await this.provider.status();
      if (!status.isConnected) return null;

      const account = await this.provider.getPrimaryAccount();
      if (account.partyId !== persisted.partyId) {
        ctx.logger.debug(
          'Send primary account changed since session was persisted; treating as expired',
          {
            persistedPartyId: persisted.partyId,
            currentPartyId: account.partyId,
          },
        );
        return null;
      }

      ctx.logger.debug('Restored Send Canton Wallet session', {
        partyId: account.partyId,
        kernelId: status.kernel?.id,
      });

      return {
        ...persisted,
        walletId: this.walletId,
        metadata: {
          ...(persisted.metadata ?? {}),
          ...buildSessionMetadata(status, account),
        },
      };
    } catch (err) {
      ctx.logger.warn('Failed to restore Send wallet session', err);
      return null;
    }
  }

  async signMessage(
    ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    try {
      if (typeof params.message !== 'string' || params.message.length === 0) {
        throw new Error('signMessage requires a non-empty string `message`');
      }

      ctx.logger.debug('Signing message with Send Canton Wallet', {
        sessionId: session.sessionId,
        messageLength: params.message.length,
      });

      const { signature } = await this.provider.signMessage(params.message);
      return {
        signature: toSignature(signature),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      throw mapSigilryError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'injected',
        details: { sessionId: session.sessionId },
      });
    }
  }

  async signTransaction(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignTransactionParams,
  ): Promise<SignedTransaction> {
    throw new CapabilityNotSupportedError(
      this.walletId,
      'signTransaction — Send fuses sign-and-submit through prepareExecuteAndWait. Use submitTransaction instead.',
    );
  }

  async submitTransaction(
    ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    const payload = params.signedTx as SendPrepareSubmissionRequest;
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error(
          'submitTransaction requires a SendPrepareSubmissionRequest as `signedTx` ' +
            `(received ${safePreview(payload)})`,
        );
      }
      if (!Array.isArray(payload.commands) || payload.commands.length === 0) {
        throw new Error(
          "submitTransaction signedTx is missing or empty required 'commands' array " +
            `(received ${safePreview(payload)})`,
        );
      }

      ctx.logger.debug('Submitting transaction via Send Canton Wallet', {
        sessionId: session.sessionId,
        commandId: payload.commandId,
      });

      const { tx } = await this.provider.prepareExecuteAndWait(payload);

      if (!tx || typeof tx !== 'object' || !tx.payload?.updateId) {
        throw new Error(
          'Send returned an unexpected shape from prepareExecuteAndWait. ' +
            `Expected { tx: { commandId, status:'executed', payload: { updateId, completionOffset } } } ` +
            `but received ${safePreview(tx)}.`,
        );
      }

      return {
        transactionHash: toTransactionHash(tx.payload.updateId),
        submittedAt: Date.now(),
        commandId: tx.commandId,
        updateId: tx.payload.updateId,
      };
    } catch (err) {
      const baseHint = templateIdHint(payload);
      // For structured Sigilry RPC errors (e.g. user pressed cancel in
      // the passkey popup → code 4001) we want the canonical mapping
      // (`UserRejectedError`). For everything else, if we have a payload
      // hint, attach it directly via TransportError so the keyword-based
      // fallback in `mapUnknownErrorToPartyLayerError` doesn't replace
      // the message with a generic `User rejected …` string and lose
      // the actionable text.
      if (baseHint && !isSendRpcError(err)) {
        const baseMessage = err instanceof Error ? err.message : String(err);
        throw new TransportError(
          baseMessage + baseHint,
          err instanceof Error ? err : undefined,
          {
            walletId: this.walletId,
            phase: 'submitTransaction',
            transport: 'injected',
            sessionId: session.sessionId,
            commandId: payload?.commandId,
          },
        );
      }
      throw mapSigilryError(err, {
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
      ctx.logger.debug('Proxying ledger API request via Send Canton Wallet', {
        sessionId: session.sessionId,
        requestMethod: params.requestMethod,
        resource: params.resource,
      });

      // Send's @sigilry/dapp schema is the canonical CIP-0103 dApp API: a
      // lower-case verb + an OBJECT body (a string body or upper-case verb →
      // INVALID_PARAMS before any ledger call). Normalize via the shared helpers.
      const result = await this.provider.ledgerApi({
        requestMethod: normalizeLedgerMethodLower(params.requestMethod),
        resource: params.resource,
        body: ledgerApiBodyToObject(params.body),
      });

      // Send's contract is `{ response: string }` — preserve raw to match
      // PartyLayer's `LedgerApiResult` exactly. Defensive fallback if a
      // future wallet build returns a parsed object.
      if (result && typeof result.response === 'string') {
        return { response: result.response };
      }
      return { response: JSON.stringify(result ?? null) };
    } catch (err) {
      throw mapSigilryError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'injected',
        details: {
          sessionId: session.sessionId,
          requestMethod: params.requestMethod,
          resource: params.resource,
        },
      });
    }
  }

  /**
   * Subscribe to PartyLayer adapter events. Currently bridges only
   * `txStatus` from Send's native `txChanged` event. Other PartyLayer
   * adapter events (`connect` / `disconnect` / `sessionExpired` / `error`)
   * are emitted by the SDK itself, not the wallet, so we no-op them.
   */
  on(event: AdapterEventName, handler: (payload: unknown) => void): () => void {
    if (event !== 'txStatus') {
      return () => {
        /* nothing to unsubscribe */
      };
    }
    const listener: SendEventListener = (...args) => {
      const tx = args[0] as SendTxChangedEvent | undefined;
      if (!tx) return;
      handler({
        status: mapTxStatus(tx.status),
        commandId: tx.commandId,
        raw: tx,
      });
    };
    try {
      this.provider.on('txChanged', listener);
    } catch {
      return () => {
        /* provider unavailable — nothing to unsubscribe */
      };
    }
    return () => this.provider.off('txChanged', listener);
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Translate Sigilry `txChanged` statuses into PartyLayer's
 * `TransactionStatus` taxonomy. Kept separate so tests can pin the mapping.
 */
function mapTxStatus(
  status: SendTxChangedEvent['status'],
): 'pending' | 'submitted' | 'committed' | 'failed' {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'signed':
      return 'submitted';
    case 'executed':
      return 'committed';
    case 'failed':
    default:
      return 'failed';
  }
}

/**
 * Pack diagnostic + restore-relevant fields into the Session metadata
 * record. PartyLayer types `Session.metadata` as `Record<string, string>`,
 * so every value must be a string — we omit anything that's missing
 * rather than writing the literal string `"undefined"`.
 */
function buildSessionMetadata(
  status: SendStatusResponse,
  account: SendAccount,
): Record<string, string> {
  const meta: Record<string, string> = {
    kernelId: status.kernel?.id ?? '',
    signingProviderId: account.signingProviderId,
    signingMethod: SEND_SIGNING_METHOD,
    publicKey: account.publicKey,
    namespace: account.namespace,
    networkId: account.networkId,
    hint: account.hint,
  };
  if (status.network?.ledgerApi?.baseUrl) {
    meta.ledgerApiBaseUrl = status.network.ledgerApi.baseUrl;
  }
  if (status.session?.userId) {
    meta.userId = status.session.userId;
  }
  // accessToken is intentionally omitted — the SDK's encrypted-storage
  // layer is for it; adapter-level metadata is plain Record<string,string>.
  return meta;
}
