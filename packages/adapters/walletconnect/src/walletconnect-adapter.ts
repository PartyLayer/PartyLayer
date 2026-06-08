/**
 * WalletConnect adapter for PartyLayer.
 *
 * WRAPS the official `WalletConnectAdapter` from `@canton-network/dapp-sdk` —
 * SIWX, the `canton_` method mapping, `session_event` handling, pairing-URI
 * delivery, and restore all come from the official adapter. This package only
 * adapts that surface to PartyLayer's `WalletAdapter` contract.
 *
 * BUILD CONSTRAINT (PR #18 landmine): `@canton-network/dapp-sdk`'s single barrel
 * entry statically does `import SignClient from '@walletconnect/sign-client'`
 * (an OPTIONAL peer). A static/top-level import of the barrel therefore eagerly
 * pulls `@walletconnect/sign-client` and breaks webpack/Next consumers that
 * haven't installed it. So the barrel is imported ONLY via dynamic `import()`
 * inside `connect()`/`restore()` — never statically — and this adapter is
 * OPT-IN (NOT in `getBuiltinAdapters()`): an app enables it by registering it
 * via `config.adapters` and installing the optional `@walletconnect/*` peers.
 */

import {
  CapabilityNotSupportedError,
  mapUnknownErrorToPartyLayerError,
  toPartyId,
  toSignature,
  toTransactionHash,
  toWalletId,
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
  type SignedMessage,
  type SignedTransaction,
  type SignMessageParams,
  type SignTransactionParams,
  type SubmitTransactionParams,
  type TxReceipt,
  type WalletAdapter,
} from '@partylayer/core';

const WALLET_ID = 'walletconnect';

/** Inline WalletConnect mark so the picker has an icon without a network fetch. */
const WALLETCONNECT_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzM0OTZmZiIvPjxwYXRoIGQ9Ik05LjUgMTIuNWMzLjYtMy41IDkuNC0zLjUgMTMgMGwuNC40Yy4yLjIuMi41IDAgLjdsLTEuNSAxLjVjLS4xLjEtLjIuMS0uMyAwbC0uNi0uNmMtMi41LTIuNC02LjUtMi40LTkgMGwtLjcuNmMtLjEuMS0uMi4xLS4zIDBMOC41IDEzLjVjLS4yLS4yLS4yLS41IDAtLjd6IiBmaWxsPSIjZmZmIi8+PC9zdmc+';

/**
 * Capabilities exposed over WalletConnect. WC reaches hosted/mobile wallets, so
 * it is a remote signer; `signTransaction` is intentionally absent (Canton WC
 * fuses sign-and-submit via `prepareExecute`).
 */
const WC_CAPABILITIES: CapabilityKey[] = [
  'connect',
  'disconnect',
  'restore',
  'signMessage',
  'submitTransaction',
  'ledgerApi',
  'events',
  'remoteSigner',
  'deeplink',
];

/** SIWX (Sign-In-With-Canton) params, forwarded verbatim to the official adapter. */
export interface SignInWithCantonParams {
  domain: string;
  uri: string;
  version: string;
  statement?: string;
  nonce?: string;
  requestId?: string;
  notBefore?: string;
  issuedAt?: string;
  expirationTime?: string;
  resources?: string[];
}

export interface WalletConnectAdapterConfig {
  /** WalletConnect Cloud project id (required). */
  projectId: string;
  /** dApp metadata shown to the wallet during pairing. */
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  /**
   * Called with the WalletConnect pairing URI. Wire this to the connect modal's
   * QR UI (mirrors how adapter-loop surfaces its pairing QR). The official
   * adapter fires it once the session proposal is created.
   */
  onUri?: (uri: string) => void;
  /** Optional SIWX request triggered after the session is established. */
  signInWithCanton?: SignInWithCantonParams;
  /** Callback for the SIWX result. */
  onSignInWithCanton?: (result: unknown) => void;
  /**
   * Optional CAIP-2 chain id. Left UNSET by default per the Canton WC spec —
   * request the `canton` namespace and use whatever network the wallet provides.
   */
  chainId?: string;
}

/**
 * Structural view of the official adapter we drive. Declared locally (NOT
 * imported from `@canton-network/dapp-sdk`) so this module references no
 * dapp-sdk types and stays free of any static dapp-sdk import.
 */
interface OfficialWcAdapter {
  request<T = unknown>(args: { method: string; params?: unknown }): Promise<T>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
  teardown(): void;
  restore(): Promise<unknown>;
  detect(): Promise<boolean>;
}

type OfficialWcFactory = (
  config: Record<string, unknown>,
) => OfficialWcAdapter | Promise<OfficialWcAdapter>;

export interface WalletConnectAdapterOptions {
  /**
   * Test seam: supply the official adapter instead of dynamically importing
   * `@canton-network/dapp-sdk`. Defaults to the real dynamic import.
   */
  createOfficialAdapter?: OfficialWcFactory;
}

/**
 * Default factory: dynamically imports the dapp-sdk barrel (deferring
 * `@walletconnect/sign-client` to connect time) and builds the official adapter.
 */
async function defaultCreateOfficialAdapter(
  config: Record<string, unknown>,
): Promise<OfficialWcAdapter> {
  const mod = (await import('@canton-network/dapp-sdk')) as unknown as {
    WalletConnectAdapter: { create(c: Record<string, unknown>): OfficialWcAdapter };
  };
  return mod.WalletConnectAdapter.create(config);
}

/** PartyLayer adapter event → CIP-0103 event emitted by the official adapter. */
const EVENT_MAP: Partial<Record<AdapterEventName, string>> = {
  txStatus: 'txChanged',
  connect: 'connected',
  disconnect: 'disconnected',
};

export class WalletConnectAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLET_ID);
  readonly name = 'WalletConnect';

  private readonly config: WalletConnectAdapterConfig;
  private readonly createOfficial: OfficialWcFactory;
  private official: OfficialWcAdapter | null = null;
  /** Per-connect display-URI callback (e.g. from the connect modal). */
  private activeDisplayUri?: (uri: string) => void;

  constructor(config: WalletConnectAdapterConfig, options?: WalletConnectAdapterOptions) {
    if (!config || typeof config.projectId !== 'string' || config.projectId.length === 0) {
      throw new Error('WalletConnectAdapter requires a `projectId`.');
    }
    this.config = config;
    this.createOfficial = options?.createOfficialAdapter ?? defaultCreateOfficialAdapter;
  }

  getCapabilities(): CapabilityKey[] {
    return WC_CAPABILITIES;
  }

  /**
   * WalletConnect is an always-available connection METHOD (not extension-gated)
   * when a `projectId` is configured. Pure (no dynamic import) so rendering the
   * picker never pulls dapp-sdk.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (!this.config.projectId) {
      return { installed: false, reason: 'WalletConnect requires a projectId' };
    }
    return {
      installed: true,
      reason: 'WalletConnect available — scan the QR with a Canton wallet',
    };
  }

  /** WalletInfo-ish metadata for pickers that surface adapters directly. */
  getInfo(): { id: string; name: string; icon: string } {
    return { id: WALLET_ID, name: this.name, icon: WALLETCONNECT_ICON };
  }

  private buildOfficialConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = { projectId: this.config.projectId };
    if (this.config.metadata) cfg.metadata = this.config.metadata;
    // Always wrap `onUri` so the pairing URI reaches BOTH the integrator's
    // config callback AND the per-connect `onDisplayUri` (e.g. the connect
    // modal's QR), without the integrator having to hand-wire anything.
    cfg.onUri = (uri: string) => this.deliverDisplayUri(uri);
    if (this.config.signInWithCanton) cfg.signInWithCanton = this.config.signInWithCanton;
    if (this.config.onSignInWithCanton) cfg.onSignInWithCanton = this.config.onSignInWithCanton;
    // chainId left UNSET by default (Canton WC: request the `canton` namespace).
    if (this.config.chainId) cfg.chainId = this.config.chainId;
    return cfg;
  }

  /** Fan the pairing URI out to the integrator callback + the active connect's handler. */
  private deliverDisplayUri(uri: string): void {
    try {
      this.config.onUri?.(uri);
    } catch {
      /* integrator callback must not break connect */
    }
    this.activeDisplayUri?.(uri);
  }

  private async ensureOfficial(): Promise<OfficialWcAdapter> {
    if (!this.official) {
      this.official = await this.createOfficial(this.buildOfficialConfig());
    }
    return this.official;
  }

  async connect(
    ctx: AdapterContext,
    opts?: {
      timeoutMs?: number;
      partyId?: PartyId;
      preferInstalled?: boolean;
      onDisplayUri?: (uri: string) => void;
    },
  ): Promise<AdapterConnectResult> {
    this.activeDisplayUri = opts?.onDisplayUri;
    const restorePopup = suppressBlankWalletPopup();
    try {
      const wc = await this.ensureOfficial();

      // Establishes the WC session: fires `onUri` (→ display URI / modal QR),
      // then awaits wallet approval.
      await wc.request({ method: 'connect' });

      const account = await wc.request<{
        partyId: string;
        publicKey?: string;
        namespace?: string;
        networkId?: string;
        signingProviderId?: string;
        hint?: string;
      }>({ method: 'getPrimaryAccount' });

      let status: {
        network?: { networkId?: string; ledgerApi?: { baseUrl?: string } };
        session?: { userId?: string; expiresAt?: number };
      } = {};
      try {
        status = await wc.request({ method: 'status' });
      } catch {
        // status is best-effort enrichment
      }

      const partyId = toPartyId(account.partyId);

      ctx.logger.info('Connected to WalletConnect', { partyId: account.partyId });

      return {
        partyId,
        session: {
          walletId: this.walletId,
          network: ctx.network,
          createdAt: Date.now(),
          ...(typeof status.session?.expiresAt === 'number'
            ? { expiresAt: status.session.expiresAt }
            : {}),
          metadata: buildSessionMetadata(account, status),
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'remote',
        details: { origin: ctx.origin, network: ctx.network },
      });
    } finally {
      restorePopup();
      this.activeDisplayUri = undefined;
    }
  }

  async disconnect(ctx: AdapterContext, _session: Session): Promise<void> {
    const wc = this.official;
    if (!wc) return;
    try {
      await wc.request({ method: 'disconnect' });
    } catch (err) {
      ctx.logger.warn('Error during WalletConnect disconnect request', err);
    }
    try {
      wc.teardown();
    } catch (err) {
      ctx.logger.warn('Error during WalletConnect teardown', err);
    }
    this.official = null;
  }

  async restore(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    try {
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;
      const wc = await this.ensureOfficial();
      const restored = await wc.restore();
      if (!restored) {
        this.official = null;
        return null;
      }
      ctx.logger.debug('Restored WalletConnect session', { partyId: persisted.partyId });
      return { ...persisted, walletId: this.walletId };
    } catch (err) {
      ctx.logger.warn('Failed to restore WalletConnect session', err);
      return null;
    }
  }

  async signMessage(
    _ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    try {
      const wc = await this.ensureOfficial();
      // The official adapter prefixes `canton_`, so this issues a
      // `canton_signMessage` request over the WalletConnect session.
      const result = await wc.request<{ signature?: string }>({
        method: 'signMessage',
        params: { message: params.message },
      });
      return {
        signature: toSignature(result?.signature ?? ''),
        partyId: session.partyId,
        message: params.message,
        nonce: params.nonce,
        domain: params.domain,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'signMessage',
        transport: 'remote',
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
      'signTransaction — Canton WalletConnect fuses sign-and-submit. Use submitTransaction instead.',
    );
  }

  async submitTransaction(
    _ctx: AdapterContext,
    session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    try {
      const wc = await this.ensureOfficial();
      const result = await wc.request<{
        tx?: { payload?: { updateId?: string }; commandId?: string };
      }>({ method: 'prepareExecuteAndWait', params: params.signedTx });
      const updateId = result?.tx?.payload?.updateId ?? result?.tx?.commandId ?? 'pending';
      return { transactionHash: toTransactionHash(updateId), submittedAt: Date.now() };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'remote',
        details: { sessionId: session.sessionId },
      });
    }
  }

  async ledgerApi(
    _ctx: AdapterContext,
    session: Session,
    params: LedgerApiParams,
  ): Promise<LedgerApiResult> {
    try {
      const wc = await this.ensureOfficial();
      // Proxies a JSON Ledger API request through the wallet via
      // `canton_ledgerApi`.
      const result = await wc.request<unknown>({
        method: 'ledgerApi',
        params: {
          requestMethod: params.requestMethod,
          resource: params.resource,
          ...(params.body !== undefined ? { body: params.body } : {}),
        },
      });
      const maybeResponse = (result as { response?: unknown } | null)?.response;
      const response =
        typeof result === 'string'
          ? result
          : typeof maybeResponse === 'string'
            ? maybeResponse
            : JSON.stringify(result ?? null);
      return { response };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'ledgerApi',
        transport: 'remote',
        details: { sessionId: session.sessionId },
      });
    }
  }

  /**
   * Subscribe to adapter events by delegating to the official adapter's event
   * bus (events arrive via `session_event` and are buffered until a listener
   * attaches, so a late subscriber still receives them). Returns an unsubscribe.
   */
  on(event: AdapterEventName, handler: (payload: unknown) => void): () => void {
    const wc = this.official;
    const mapped = EVENT_MAP[event];
    if (!wc || !mapped) {
      return () => {
        /* not connected yet, or no mapped wallet event */
      };
    }

    const listener =
      event === 'txStatus'
        ? (...args: unknown[]) => {
            const tx = args[0] as { status?: string; commandId?: string } | undefined;
            if (!tx) return;
            handler({ status: mapTxStatus(tx.status), commandId: tx.commandId, raw: tx });
          }
        : (...args: unknown[]) => handler(args[0]);

    wc.on(mapped, listener);
    return () => {
      try {
        wc.removeListener(mapped, listener);
      } catch {
        /* provider torn down */
      }
    };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * The official dapp-sdk adapter unconditionally opens a blank popup via
 * `window.open('', 'wallet-popup')` (its own QR popup) during WC connect, even
 * when we render the QR ourselves. There is no config flag to disable it, so we
 * narrowly intercept ONLY that specific `window.open` (target `wallet-popup`)
 * for the duration of connect and return null — which makes `showUriInPopup`
 * early-return without creating a window. Returns a restore function; all other
 * `window.open` calls pass through untouched.
 */
function suppressBlankWalletPopup(): () => void {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return () => {};
  }
  const original = window.open;
  window.open = ((
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null => {
    if (target === 'wallet-popup') return null;
    return original.call(window, url as string, target as string, features as string);
  }) as typeof window.open;
  return () => {
    window.open = original;
  };
}

/** Translate Canton `txChanged` statuses to PartyLayer's TransactionStatus. */
function mapTxStatus(
  status: string | undefined,
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

/** String-only Session metadata (Session.metadata is Record<string,string>). */
function buildSessionMetadata(
  account: {
    publicKey?: string;
    namespace?: string;
    networkId?: string;
    signingProviderId?: string;
    hint?: string;
  },
  status: {
    network?: { networkId?: string; ledgerApi?: { baseUrl?: string } };
    session?: { userId?: string };
  },
): Record<string, string> {
  const meta: Record<string, string> = { transport: 'walletconnect' };
  if (account.publicKey) meta.publicKey = account.publicKey;
  if (account.namespace) meta.namespace = account.namespace;
  if (account.networkId) meta.networkId = account.networkId;
  if (account.signingProviderId) meta.signingProviderId = account.signingProviderId;
  if (account.hint) meta.hint = account.hint;
  if (status.network?.networkId) meta.networkId = status.network.networkId;
  if (status.network?.ledgerApi?.baseUrl) meta.ledgerApiBaseUrl = status.network.ledgerApi.baseUrl;
  if (status.session?.userId) meta.userId = status.session.userId;
  return meta;
}
