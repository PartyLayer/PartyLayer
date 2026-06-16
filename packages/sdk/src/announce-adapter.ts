/**
 * Dynamic adapter for an announced CIP-0103 wallet that has no first-party
 * PartyLayer adapter.
 *
 * Canonical contract (provider.md): after `canton:requestProvider`, wallets
 * announce `{ id, name?, icon?, target? }`; "the SDK … registers one adapter
 * per id with providerId `browser:ext:<id>`". This adapter is that registration
 * for the UNKNOWN case — it delegates every call to a `CIP0103Provider` bound to
 * the wallet's own extension `target` channel (built by
 * `createExtensionChannelProvider({ target: announced.target ?? announced.id })`).
 * Because the channel is target-scoped, a click on this entry can ONLY ever
 * reach the wallet that announced it — never a shared `window.canton` slot or
 * another wallet (the A2 collision guarantee), and future announce-capable
 * Canton wallets light up with zero code changes.
 *
 * KNOWN wallets (Console, Send, …) never use this class — the SDK's identity
 * bridge maps their announce id to their existing adapter via `providerDetection`.
 *
 * OPTIONAL CAPABILITIES (additive; wagmi's optional-method model): a registry
 * announce entry (`adapter.transport: 'announce'`) can opt a wallet into the
 * optional CIP-0103 surface via {@link AnnounceAdapterConfig}. Each optional
 * method is assigned in the constructor ONLY when configured, so it stays
 * `undefined` otherwise (feature-detection honest) and `getCapabilities()`
 * derives from what is actually present. With NO config the behavior is exactly
 * the baseline: 3 capabilities + a minimal session.
 */
import type {
  AdapterConnectResult,
  AdapterContext,
  AdapterDetectResult,
  AdapterEventName,
  CapabilityKey,
  CIP0103Account,
  CIP0103EventListener,
  CIP0103Provider,
  CIP0103TxChangedEvent,
  LedgerApiParams,
  LedgerApiResult,
  NetworkId,
  PersistedSession,
  Session,
  SignMessageParams,
  SignedMessage,
  SubmitTransactionParams,
  TxReceipt,
  WalletAdapter,
  WalletId,
} from '@partylayer/core';
import { toPartyId, toWalletId } from '@partylayer/core';

/** Canonical providerId prefix for an announced extension (provider.md: `browser:ext:<id>`). */
export const ANNOUNCED_WALLET_ID_PREFIX = 'browser:ext:';

/** Build the canonical SDK walletId for an announced extension id. */
export function announcedWalletId(announceId: string): WalletId {
  return toWalletId(`${ANNOUNCED_WALLET_ID_PREFIX}${announceId}`);
}

/**
 * Opt-in configuration for an announced wallet's OPTIONAL capabilities. Sourced
 * from its registry entry (`adapter.transport: 'announce'`): `events` from
 * `capabilities.events`, the rest from `adapter.config`. Every field is opt-in;
 * an absent config is byte-identical to the baseline 3-capability adapter.
 */
export interface AnnounceAdapterConfig {
  /** Enable `on()` — bridge the provider's CIP-0103 `txChanged` → adapter `txStatus`. */
  events?: boolean;
  /** Enable `restore()` — silent `status()`/`getPrimaryAccount()` probe + party-match. */
  restore?: boolean;
  /** Enable `ledgerApi()` — proxy the standard CIP-0103 `ledgerApi` call. */
  ledgerApi?: boolean;
  /** Populate the richer `session.metadata` on connect when the provider returns it. */
  metadata?: boolean;
  /**
   * Declarative wallet-specific STATIC metadata (e.g. `{ signingMethod:
   * 'webauthn-prf' }`) — the wagmi connector-property pattern (like rdns/iconUrl).
   * Merged into `session.metadata` ONLY when `metadata` is enabled, and FILLS
   * GAPS: runtime RPC values (from `status`/account) take precedence on a key
   * collision (EIP-6963: the wallet's runtime announce is authoritative).
   */
  staticMetadata?: Record<string, string>;
  /**
   * Optional error-translation hook. Given first crack at a thrown error: return
   * an `Error` to surface it, or `undefined` to fall through to the SDK's
   * built-in standard EIP-1193/-1474 mapping. A generic mechanism — not
   * wallet-specific code.
   */
  mapError?: (err: unknown) => Error | undefined;
}

export interface GenericAnnounceAdapterArgs {
  /** The announced extension id (== announce `detail.id`). */
  announceId: string;
  /** Display name from the announce detail (falls back to a derived label). */
  name?: string;
  /** Icon (data: URI or URL) from the announce detail. */
  icon?: string;
  /** Target-scoped CIP-0103 provider built from the announce (the discovery result). */
  provider: CIP0103Provider;
  /**
   * Override the adapter's walletId. Defaults to `browser:ext:<announceId>` (the
   * UNKNOWN-wallet case). For a KNOWN registry announce wallet, pass its registry
   * walletId so the adapter registers under the id its picker entry resolves by.
   */
  walletId?: WalletId;
  /** Optional opt-in capabilities (registry-driven). Absent ⇒ baseline behavior. */
  config?: AnnounceAdapterConfig;
}

/** Status shape we read opportunistically (all fields optional; wallet-dependent). */
interface AnnounceStatus {
  isConnected?: boolean;
  connection?: { isConnected?: boolean };
  /** Standard splice-wallet-kernel / CIP-0103 runtime kernel info (not wallet-specific). */
  kernel?: { id?: string };
  network?: { networkId?: string; ledgerApi?: { baseUrl?: string } };
  session?: { userId?: string };
}

/** Translate a CIP-0103 `txChanged` status to PartyLayer's adapter `txStatus` taxonomy. */
function mapTxStatus(
  status: CIP0103TxChangedEvent['status'],
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

export class GenericAnnounceAdapter implements WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  /** Icon surfaced to the picker (announce detail). */
  readonly icon?: string;
  private readonly provider: CIP0103Provider;
  private readonly metadataEnabled: boolean;
  private readonly staticMetadata?: Record<string, string>;
  private readonly mapError?: (err: unknown) => Error | undefined;

  // Optional WalletAdapter surface — assigned in the ctor ONLY when configured,
  // so `getCapabilities()` and `'x' in adapter` feature-detection stay honest.
  restore?: WalletAdapter['restore'];
  on?: WalletAdapter['on'];
  ledgerApi?: WalletAdapter['ledgerApi'];

  constructor(args: GenericAnnounceAdapterArgs) {
    this.walletId = args.walletId ?? announcedWalletId(args.announceId);
    this.name =
      args.name && args.name.length > 0
        ? args.name
        : `Canton Wallet (${args.announceId.slice(0, 6)}…)`;
    this.icon = args.icon;
    this.provider = args.provider;

    const config = args.config;
    this.metadataEnabled = config?.metadata === true;
    this.staticMetadata = config?.staticMetadata;
    this.mapError = config?.mapError;
    if (config?.events) this.on = this.makeOn();
    if (config?.restore) this.restore = this.makeRestore();
    if (config?.ledgerApi) this.ledgerApi = this.makeLedgerApi();
  }

  /**
   * Capabilities: the baseline three plus whatever optional methods were
   * configured (derived from actual presence, never advertised when absent).
   */
  getCapabilities(): CapabilityKey[] {
    const caps: CapabilityKey[] = ['connect', 'signMessage', 'submitTransaction'];
    if (this.restore) caps.push('restore');
    if (this.ledgerApi) caps.push('ledgerApi');
    if (this.on) caps.push('events');
    return caps;
  }

  /**
   * The adapter is only ever constructed for a wallet that just announced, so
   * its presence is established by the announce handshake itself.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true, reason: 'Announced via canton:announceProvider' };
  }

  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    return this.guarded(async () => {
      // CIP-0103 connect handshake over the target-scoped channel.
      await this.provider.request({ method: 'connect' });
      const account = await this.provider.request<CIP0103Account>({
        method: 'getPrimaryAccount',
      });

      // Wallet-reported network (truthful), per A1b — fall back to dApp config.
      let status: AnnounceStatus | undefined;
      try {
        status = await this.provider.request<AnnounceStatus>({ method: 'status' });
      } catch {
        // status is optional for some wallets — fall through to account/config.
      }
      const reportedNetwork = status?.network?.networkId;

      const partyId = toPartyId(account.partyId);
      const session: Partial<Session> = {
        walletId: this.walletId,
        partyId,
        network: (reportedNetwork ?? account.networkId ?? ctx.network) as NetworkId,
      };
      // Additive: richer metadata only when opted in AND the provider returned it.
      // Static config fills gaps; runtime RPC wins on a key collision (static
      // FIRST, RPC LAST). No staticMetadata ⇒ identical to the kernelId step.
      if (this.metadataEnabled) {
        session.metadata = { ...(this.staticMetadata ?? {}), ...buildMetadata(status, account) };
      }
      return { partyId, session, capabilities: this.getCapabilities() };
    });
  }

  async disconnect(): Promise<void> {
    try {
      await this.provider.request({ method: 'disconnect' });
    } catch {
      // best-effort; a wallet that doesn't support disconnect is not fatal.
    }
  }

  async signMessage(
    _ctx: AdapterContext,
    _session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    return this.guarded(() =>
      this.provider.request<SignedMessage>({
        method: 'signMessage',
        params: { message: params.message },
      }),
    );
  }

  async submitTransaction(
    _ctx: AdapterContext,
    _session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    return this.guarded(() =>
      this.provider.request<TxReceipt>({
        method: 'prepareExecute',
        params: params as unknown as Record<string, unknown>,
      }),
    );
  }

  // ── Optional-method factories (assigned only when configured) ──────────────

  /** events: bridge the provider's CIP-0103 `txChanged` push event → `txStatus`. */
  private makeOn(): WalletAdapter['on'] {
    return (event: AdapterEventName, handler: (payload: unknown) => void): (() => void) => {
      // Only txChanged maps to an existing AdapterEventName; others are no-ops.
      if (event !== 'txStatus') return () => {};
      const listener: CIP0103EventListener = (...args: unknown[]) => {
        const tx = args[0] as CIP0103TxChangedEvent | undefined;
        if (!tx) return;
        handler({ status: mapTxStatus(tx.status), commandId: tx.commandId, raw: tx });
      };
      try {
        this.provider.on('txChanged', listener);
      } catch {
        return () => {
          /* provider unavailable — nothing to unsubscribe */
        };
      }
      return () => this.provider.removeListener('txChanged', listener);
    };
  }

  /** restore: silent status()/getPrimaryAccount() probe + expiry + party-match. */
  private makeRestore(): WalletAdapter['restore'] {
    return (_ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> =>
      this.guarded(async () => {
        if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;
        let status: AnnounceStatus | undefined;
        try {
          status = await this.provider.request<AnnounceStatus>({ method: 'status' });
        } catch {
          // status is a best-effort probe; rely on the account match below.
        }
        // Only reject on an EXPLICIT disconnected signal (lenient for wallets
        // whose status shape omits it).
        const connected = status?.isConnected ?? status?.connection?.isConnected;
        if (connected === false) return null;

        const account = await this.provider.request<CIP0103Account>({
          method: 'getPrimaryAccount',
        });
        if (account.partyId !== persisted.partyId) return null;

        return {
          ...persisted,
          walletId: this.walletId,
          // persisted (lowest) → static config → runtime RPC (wins).
          metadata: {
            ...(persisted.metadata ?? {}),
            ...(this.staticMetadata ?? {}),
            ...buildMetadata(status, account),
          },
        };
      });
  }

  /** ledgerApi: proxy the standard CIP-0103 ledgerApi call; shape to {response:string}. */
  private makeLedgerApi(): WalletAdapter['ledgerApi'] {
    return (_ctx: AdapterContext, _session: Session, params: LedgerApiParams): Promise<LedgerApiResult> =>
      this.guarded(async () => {
        const result = await this.provider.request<{ response?: string }>({
          method: 'ledgerApi',
          params: {
            requestMethod: params.requestMethod,
            resource: params.resource,
            body: params.body,
          },
        });
        if (result && typeof result.response === 'string') return { response: result.response };
        return { response: JSON.stringify(result ?? null) };
      });
  }

  /**
   * Run an operation, giving the optional `mapError` hook first crack at any
   * thrown error. With NO hook configured this is a direct pass-through (no
   * try/catch) — byte-identical to the baseline, and the SDK's built-in standard
   * error mapping still applies downstream.
   */
  private async guarded<T>(op: () => Promise<T>): Promise<T> {
    if (!this.mapError) return op();
    try {
      return await op();
    } catch (err) {
      const mapped = this.mapError(err);
      throw mapped ?? err;
    }
  }
}

/** Build the string-only session metadata from a status/account (omit missing). */
function buildMetadata(
  status: AnnounceStatus | undefined,
  account: CIP0103Account,
): Record<string, string> {
  const meta: Record<string, string> = {};
  const put = (k: string, v: unknown): void => {
    if (typeof v === 'string' && v.length > 0) meta[k] = v;
  };
  put('kernelId', status?.kernel?.id);
  put('publicKey', account.publicKey);
  put('namespace', account.namespace);
  put('networkId', account.networkId);
  put('signingProviderId', account.signingProviderId);
  put('hint', account.hint);
  put('ledgerApiBaseUrl', status?.network?.ledgerApi?.baseUrl);
  put('userId', status?.session?.userId);
  return meta;
}
