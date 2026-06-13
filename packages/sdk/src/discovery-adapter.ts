/**
 * Generic bridge from an official `@canton-network/core-wallet-discovery`
 * `ProviderAdapter` (matched structurally as `OfficialProviderAdapter`) to our
 * `WalletAdapter` contract.
 *
 * This is the GENERIC host for popup/remote Canton wallets that neither inject
 * `window.canton` nor announce via `canton:announceProvider` (e.g. Walley): the
 * app supplies the wallet's OWN official adapter instance in `config.adapters`,
 * and the SDK auto-wraps it here. There is NO wallet-specific package in our
 * codebase — any standards-compliant wallet shipping the official ProviderAdapter
 * shape inherits this path. We deliberately do NOT import `@canton-network/*`
 * (mirroring `@partylayer/provider`'s extension-channel); the standard's SHAPE
 * is the contract.
 *
 * Sibling to `GenericAnnounceAdapter`: both delegate every call to a
 * `CIP0103Provider`. The difference is the source — here the provider comes from
 * the official adapter's `provider()` (obtained LAZILY so SDK init stays
 * SSR-safe; the wallet's `provider()` may touch `window`).
 *
 * Host/network are baked into the app-supplied official adapter at construction
 * (e.g. `new WalleyAdapter({ host: 'https://dev.walley.cc' })`), so the bridge
 * never sees or sets them.
 *
 * Eventless note: the official provider exposes `on`/`emit`/`removeListener`
 * but popup/remote wallets typically never emit. The session layer restores via
 * `status`/`listAccounts` polling + persists on fresh connect, so this is
 * tolerated; `getCapabilities()` therefore NEVER returns `'events'`.
 */
import type {
  AdapterConnectResult,
  AdapterContext,
  AdapterDetectResult,
  CapabilityKey,
  CIP0103Account,
  CIP0103Provider,
  NetworkHosts,
  NetworkId,
  OfficialAdapterFactory,
  OfficialProviderAdapter,
  Session,
  SignMessageParams,
  SignedMessage,
  SubmitTransactionParams,
  TxReceipt,
  WalletAdapter,
  WalletId,
} from '@partylayer/core';
import { toPartyId, toWalletId } from '@partylayer/core';

export interface GenericDiscoveryAdapterArgs {
  /**
   * Pre-constructed official adapter (explicit-host form, e.g.
   * `new WalleyAdapter({ host })`). Its baked host is used as-is; `factory` /
   * `networkHosts` are ignored. Mutually exclusive with `factory`.
   */
  official?: OfficialProviderAdapter;
  /**
   * Factory form: `create(host)` constructs the official adapter with a host
   * resolved from `networkHosts[activeNetwork]` at connect time. Needed because
   * official adapters seal `host` at construction (no re-hosting a pre-built
   * instance). Mutually exclusive with `official`.
   */
  factory?: OfficialAdapterFactory;
  /**
   * Network→host map for the factory form (the registry entry's
   * `adapter.networkHosts`). Injected by the SDK once the registry is loaded
   * (see {@link GenericDiscoveryAdapter.setNetworkHosts}); resolved
   * SYNCHRONOUSLY at connect so the popup-safe gesture path holds.
   */
  networkHosts?: NetworkHosts;
  /**
   * SDK walletId for this wallet. Defaults to `toWalletId(providerId)` so it
   * aligns with the registry entry whose `id` equals the provider id (the
   * convention for `transport: 'discovery-adapter'` entries). Pass explicitly
   * to bind to a different registry id.
   */
  walletId?: WalletId;
  /** Display name override (falls back to the official adapter's / factory's name). */
  name?: string;
  /** Icon override (falls back to the official adapter's / factory's icon). */
  icon?: string;
}

export class GenericDiscoveryAdapter implements WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  readonly icon?: string;
  /**
   * Resolved official adapter. Set at construction for the instance form; for
   * the factory form it stays null until {@link resolveOfficial} constructs it
   * with the network-resolved host.
   */
  private official: OfficialProviderAdapter | null;
  /** Factory form (null for the instance form). */
  private readonly factory: OfficialAdapterFactory | null;
  /** Network→host map for the factory form; injected by the SDK post-registry. */
  private networkHosts: NetworkHosts;
  /** Lazily resolved from `official.provider()` — NOT at construction (SSR-safe). */
  private providerInstance: CIP0103Provider | null = null;

  constructor(args: GenericDiscoveryAdapterArgs) {
    if (args.official) {
      this.official = args.official;
      this.factory = null;
      this.networkHosts = {};
      this.walletId = args.walletId ?? toWalletId(args.official.providerId);
      this.name =
        args.name && args.name.length > 0 ? args.name : args.official.name;
      this.icon = args.icon ?? args.official.icon;
    } else if (args.factory) {
      this.official = null;
      this.factory = args.factory;
      this.networkHosts = args.networkHosts ?? {};
      this.walletId = args.walletId ?? toWalletId(args.factory.providerId);
      this.name =
        args.name && args.name.length > 0
          ? args.name
          : args.factory.name ?? args.factory.providerId;
      this.icon = args.icon ?? args.factory.icon;
    } else {
      throw new Error(
        'GenericDiscoveryAdapter requires either `official` (instance) or `factory`.',
      );
    }
  }

  /** Whether this bridge resolves its host from `networkHosts` (factory form). */
  usesFactory(): boolean {
    return this.factory !== null;
  }

  /**
   * Inject the registry's network→host map (factory form only). SYNCHRONOUS —
   * the SDK calls this during the async warm phase once the registry entry is
   * loaded, BEFORE the (possibly gesture-synchronous) connect.
   */
  setNetworkHosts(networkHosts: NetworkHosts): void {
    if (this.factory) this.networkHosts = networkHosts ?? {};
  }

  /**
   * Resolve + construct the official adapter for `network` — SYNCHRONOUS, so the
   * popup-safe gesture path reaches `window.open` with NO awaits. Idempotent.
   * The SDK pre-calls it during warm-up; `connect()` also calls it as its first
   * statement so a cold (un-warmed) connect is still gesture-safe.
   *
   * Failure is CLEAR, never a silent wrong-network host: a factory wallet with
   * no host for `network` in `networkHosts` throws, naming the network.
   */
  resolveOfficial(network: NetworkId): void {
    if (this.official) return; // instance form, or already resolved
    if (!this.factory) return; // unreachable (constructor rejects neither)
    const host = this.networkHosts[network];
    if (!host) {
      throw new Error(
        `Wallet "${String(this.walletId)}" has no host for network "${network}". ` +
          `Add it to the registry entry's adapter.networkHosts, or supply a ` +
          `pre-constructed official adapter with an explicit host.`,
      );
    }
    this.official = this.factory.create(host);
  }

  /** Lazily obtain (and cache) the official provider — deferred off the init/SSR path.
   *  `official.provider()` is typed `OfficialProvider` (loose `request` so real
   *  official adapters are assignable); it is call-compatible with CIP0103Provider
   *  (the bridge only ever calls `request({ method, params })`). */
  private get provider(): CIP0103Provider {
    if (this.providerInstance === null) {
      if (!this.official) {
        throw new Error(
          `Wallet "${String(this.walletId)}" provider requested before host ` +
            `resolution — call resolveOfficial(network) first.`,
        );
      }
      this.providerInstance = this.official.provider() as unknown as CIP0103Provider;
    }
    return this.providerInstance;
  }

  /**
   * Baseline CIP-0103 capabilities. NEVER includes `'events'`: popup/remote
   * wallets expose the event surface but do not emit (truthfulness doctrine).
   */
  getCapabilities(): CapabilityKey[] {
    return ['connect', 'disconnect', 'signMessage', 'submitTransaction'];
  }

  /** Install/availability probe — delegated to the official adapter (popup-free). */
  async detectInstalled(): Promise<AdapterDetectResult> {
    // Factory form not yet host-resolved (probed before connect/warm-up): a
    // popup/remote wallet is "available" wherever the official can be built;
    // treat as installed — the real availability check runs at connect.
    if (!this.official) {
      return { installed: true, reason: 'Popup/remote wallet (resolved at connect)' };
    }
    try {
      const installed = await this.official.detect();
      return {
        installed,
        reason: installed ? undefined : 'Wallet reported not available',
      };
    } catch {
      // A failing detect must not crash discovery; treat as not-installed.
      return { installed: false, reason: 'Detection failed' };
    }
  }

  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    // Resolve the official adapter for the active network FIRST and
    // SYNCHRONOUSLY (no await precedes it) — for the factory form this builds
    // the official with the network-resolved host; for the instance form it is a
    // no-op. Keeps the popup-safe invariant: the next line's window.open is the
    // first awaited op, so it survives the user gesture. Idempotent with warm-up.
    this.resolveOfficial(ctx.network);
    // CIP-0103 connect handshake over the official provider. For popup wallets
    // this opens the wallet's popup; it must be reached SYNCHRONOUSLY from the
    // user gesture (see the SDK's popup-safe connect fast-path).
    await this.provider.request({ method: 'connect' });
    const account = await this.provider.request<CIP0103Account>({
      method: 'getPrimaryAccount',
    });

    // Wallet-reported network (truthful) → fall back to account, then dApp config.
    let reportedNetwork: string | undefined;
    try {
      const status = await this.provider.request<{ network?: { networkId?: string } }>({
        method: 'status',
      });
      reportedNetwork = status?.network?.networkId;
    } catch {
      // status is optional for some wallets — fall through.
    }

    const partyId = toPartyId(account.partyId);
    const session: Partial<Session> = {
      walletId: this.walletId,
      partyId,
      network: (reportedNetwork ?? account.networkId ?? ctx.network) as NetworkId,
    };
    return { partyId, session, capabilities: this.getCapabilities() };
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
    return this.provider.request<SignedMessage>({
      method: 'signMessage',
      params: { message: params.message },
    });
  }

  async submitTransaction(
    _ctx: AdapterContext,
    _session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    return this.provider.request<TxReceipt>({
      method: 'prepareExecute',
      params: params as unknown as Record<string, unknown>,
    });
  }
}
