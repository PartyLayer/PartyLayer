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
 * Session restore forwards to the official adapter's own `restore` (see {@link
 * GenericDiscoveryAdapter.restore}): on reload the wallet reinstates its session, typically
 * from its own storage, and the bridge adopts the returned live provider, so the first
 * request after reload works. A silent primary-account probe validates the persisted party;
 * an expired or unavailable provider requires reconnection.
 *
 * Eventless note: the official provider exposes `on`/`emit`/`removeListener`
 * but popup/remote wallets typically never emit, so `getCapabilities()` NEVER
 * returns `'events'`.
 */
import type {
  AdapterConnectResult,
  AdapterContext,
  AdapterDetectResult,
  CapabilityKey,
  CIP0103Account,
  CIP0103Provider,
  LedgerApiParams,
  LedgerApiResult,
  NetworkHosts,
  NetworkId,
  OfficialAdapterFactory,
  OfficialProviderAdapter,
  PersistedSession,
  Session,
  SignMessageParams,
  SignedMessage,
  SubmitTransactionParams,
  TxReceipt,
  WalletAdapter,
  WalletId,
} from '@partylayer/core';
import { toPartyId, toWalletId, isRecognizedNetwork, normalizeLedgerMethodLower, ledgerApiBodyToObject, detectNetworkMismatch } from '@partylayer/core';
import { submitViaPrepareExecute, type ExecuteVerbState } from './prepare-execute';
import { normalizeSignedMessage } from './sign-message';
import { assertConnectionAccepted, assertPrimaryParty } from './connection-result';
import { nativeAdapterCopies, nativeOwnerBindings } from './native-owner';

export interface GenericDiscoveryAdapterArgs {
  /**
   * Pre-constructed official adapter (explicit-host form, e.g.
   * `new WalleyAdapter({ host })`). Its baked host is used as-is; `factory` /
   * `networkHosts` are ignored. Mutually exclusive with `factory`.
   */
  official?: OfficialProviderAdapter;
  /** Declared registry capabilities; only methods implemented by this bridge are exposed. */
  capabilities?: Partial<Record<CapabilityKey, boolean>>;
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

/** The generic bridge's implemented methods, constrained by registry declarations. */
export function getDiscoveryCapabilities(
  declared?: Partial<Record<CapabilityKey, boolean>>,
): CapabilityKey[] {
  const capabilities: CapabilityKey[] = ['connect', 'disconnect'];
  if (declared?.signMessage !== false) capabilities.push('signMessage');
  if (declared?.submitTransaction !== false) capabilities.push('submitTransaction');
  if (declared?.ledgerApi) capabilities.push('ledgerApi');
  return capabilities;
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

  /**
   * Which execute verb this wallet turned out to support. Resolved on the first
   * submit and reused, so the wallet is asked at most once.
   */
  private readonly executeVerb: ExecuteVerbState = {};
  private readonly capabilities: CapabilityKey[];
  readonly ledgerApi?: WalletAdapter['ledgerApi'];

  constructor(args: GenericDiscoveryAdapterArgs) {
    const configuration = { ...args, capabilities: args.capabilities && { ...args.capabilities } };
    nativeAdapterCopies.set(this, () => new GenericDiscoveryAdapter({
      ...configuration, networkHosts: { ...this.networkHosts },
    }));
    this.capabilities = getDiscoveryCapabilities(args.capabilities);
    if (args.capabilities?.ledgerApi) {
      this.ledgerApi = async (_ctx, _session, params: LedgerApiParams): Promise<LedgerApiResult> => {
        const result = await this.provider.request<{ response?: string }>({
          method: 'ledgerApi', params: {
            requestMethod: normalizeLedgerMethodLower(params.requestMethod),
            resource: params.resource, body: ledgerApiBodyToObject(params.body),
          },
        });
        return { response: typeof result?.response === 'string' ? result.response : JSON.stringify(result ?? null) };
      };
    }
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

  /** @internal Prepare the official owner before a popup-opening click. */
  async prepareNativeConnection(network: NetworkId): Promise<void> {
    const owner = nativeOwnerBindings.get(this);
    if (!owner) return;
    this.resolveOfficial(network);
    await owner.prepare(String(this.walletId), this.official!, network);
  }

  /** Lazily obtain (and cache) the official provider — deferred off the init/SSR path.
   *  `official.provider()` is typed `OfficialProvider` (loose `request` so real
   *  official adapters are assignable); it is call-compatible with CIP0103Provider
   *  (the bridge only ever calls `request({ method, params })`). */
  private get provider(): CIP0103Provider {
    const owner = nativeOwnerBindings.get(this);
    if (owner) return owner.getProvider(String(this.walletId));
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

  /** Implemented, registry-declared capabilities; popup event listeners are never claimed. */
  getCapabilities(): CapabilityKey[] {
    return [...this.capabilities];
  }

  /**
   * THE SINGLE PLACE THE discovery-adapter RULE IS APPLIED.
   *
   * **A `discovery-adapter` transport implies there is no local install.** Every
   * wallet on that transport is a hosted popup or remote gateway reached with
   * `window.open` — Walley, Cauri and OneSwap today. There is no extension, no
   * injected global, nothing on the machine to probe. The honest answer is
   * `no-local-install`, and it follows from the registry entry alone.
   *
   * SO THE VENDOR'S `detect()` IS NOT CALLED, and reinstating that call would be
   * a regression however much it looks like rigour. Read from their shipped
   * source, all three are constants:
   *
   *     walley:   typeof window < "u" && typeof window.open == "function"
   *     cauri:    Promise.resolve(true)
   *     oneswap:  typeof window !== 'undefined'
   *
   * Each returns true in any browser. Awaiting them bought a value carrying no
   * information, at the cost of an async hop on the picker's render path and a
   * dependency on three third parties independently choosing to answer
   * honestly. The registry already knows, it is signed, and it cannot drift.
   *
   * `installed: false` is deliberate and is NOT "not available": there is no
   * local install, so the only truthful value for a field that asks about one
   * is false. A picker must read `availability`, which says why.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    return {
      installed: false,
      availability: { kind: 'no-local-install' },
      reason: 'Hosted popup wallet — opens in a window; nothing is installed locally',
    };
  }

  async connect(ctx: AdapterContext, options?: { signal?: AbortSignal }): Promise<AdapterConnectResult> {
    // Resolve the official adapter for the active network FIRST and
    // SYNCHRONOUSLY (no await precedes it) — for the factory form this builds
    // the official with the network-resolved host; for the instance form it is a
    // no-op. Keeps the popup-safe invariant: the next line's window.open is the
    // first awaited op, so it survives the user gesture. Idempotent with warm-up.
    this.resolveOfficial(ctx.network);
    // CIP-0103 connect handshake over the official provider. For popup wallets
    // this opens the wallet's popup; it must be reached SYNCHRONOUSLY from the
    // user gesture (see the SDK's popup-safe connect fast-path).
    const owner = nativeOwnerBindings.get(this);
    const native = owner ? await owner.connect(String(this.walletId), options?.signal) : undefined;
    if (!owner) assertConnectionAccepted(await this.provider.request({ method: 'connect' }));
    const account = native?.account ?? await this.provider.request<CIP0103Account>({
      method: 'getPrimaryAccount',
    });
    assertPrimaryParty(account);

    // Wallet-reported network (truthful) → fall back to account, then dApp config.
    let reportedNetwork: string | undefined;
    try {
      const status = native?.status ?? await this.provider.request<{ network?: { networkId?: string } }>({
        method: 'status',
      });
      reportedNetwork = status?.network?.networkId;
    } catch {
      // status is optional for some wallets — fall through.
    }

    // Network capture: trust the FIRST RECOGNIZED of [wallet-reported, account,
    // dApp ctx]. A wallet may report an UNRECOGNIZED network (e.g. Walley's
    // `canton:unknown` on devnet); an unrecognized value must NOT override the
    // dApp's configured `ctx.network` — otherwise the persisted session.network
    // is uninterpretable and the network-mismatch gate can't protect it. Falls
    // back to ctx.network (the dApp's authoritative network) when nothing
    // recognized is reported.
    const partyId = toPartyId(account.partyId);
    const network =
      [reportedNetwork, account.networkId, ctx.network].find(
        (n): n is string => typeof n === 'string' && isRecognizedNetwork(n),
      ) ?? ctx.network;
    const session: Partial<Session> = {
      walletId: this.walletId,
      partyId,
      network: network as NetworkId,
    };
    return { partyId, session, capabilities: this.getCapabilities() };
  }

  /** Restore silently and validate the live party before exposing a connected session. */
  async restore(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    try {
      if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;
      this.resolveOfficial(ctx.network);
      const owner = nativeOwnerBindings.get(this);
      if (owner) {
        await this.prepareNativeConnection(ctx.network);
        const restored = await owner.restore({
          id: String(this.walletId), partyId: persisted.partyId, network: persisted.network,
        });
        return restored?.id === String(this.walletId)
          ? { ...persisted, walletId: this.walletId, capabilitiesSnapshot: this.getCapabilities() } as Session : null;
      }
      if (this.official?.restore) {
        const restored = await this.official.restore();
        if (!restored) return null;
        this.providerInstance = restored as unknown as CIP0103Provider;
      }
      // Some providers persist authentication themselves without an adapter restore().
      // A silent account probe distinguishes that case from an expired session.
      const account = await this.provider.request<CIP0103Account>({ method: 'getPrimaryAccount' });
      if (account.partyId !== persisted.partyId) return null;
      let status: { connection?: { isConnected?: boolean }; network?: { networkId?: string } } | undefined;
      try { status = await this.provider.request({ method: 'status' }); } catch { /* Use the account network if status is unavailable. */ }
      if (status?.connection?.isConnected === false) return null;
      const network = [status?.network?.networkId, account.networkId].find(
        (value): value is string => typeof value === 'string' && isRecognizedNetwork(value),
      );
      if (network && detectNetworkMismatch(persisted.network, network)) return null;
      return { ...persisted, walletId: this.walletId, capabilitiesSnapshot: this.getCapabilities() } as Session;
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    const owner = nativeOwnerBindings.get(this);
    if (owner) { await owner.disconnect(); return; }
    try {
      await this.provider.request({ method: 'disconnect' });
    } catch {
      // best-effort; a wallet that doesn't support disconnect is not fatal.
    }
  }

  async signMessage(
    _ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    const response = await this.provider.request<unknown>({
      method: 'signMessage',
      params: { message: params.message },
    });
    return normalizeSignedMessage(response, session, params);
  }

  async submitTransaction(
    ctx: AdapterContext,
    _session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    return submitViaPrepareExecute(this.provider, params, {
      walletId: String(this.walletId),
      state: this.executeVerb,
      logger: ctx.logger,
    });
  }
}
