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
  NetworkId,
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
  /** App-supplied official adapter (e.g. `new WalleyAdapter({ host })`). */
  official: OfficialProviderAdapter;
  /**
   * SDK walletId for this wallet. Defaults to `toWalletId(official.providerId)`
   * so it aligns with the registry entry whose `id` equals the provider id
   * (the convention for `transport: 'discovery-adapter'` entries). Pass
   * explicitly to bind to a different registry id.
   */
  walletId?: WalletId;
  /** Display name override (falls back to the official adapter's name). */
  name?: string;
  /** Icon override (falls back to the official adapter's icon). */
  icon?: string;
}

export class GenericDiscoveryAdapter implements WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  readonly icon?: string;
  private readonly official: OfficialProviderAdapter;
  /** Lazily resolved from `official.provider()` — NOT at construction (SSR-safe). */
  private providerInstance: CIP0103Provider | null = null;

  constructor(args: GenericDiscoveryAdapterArgs) {
    this.official = args.official;
    this.walletId = args.walletId ?? toWalletId(args.official.providerId);
    this.name =
      args.name && args.name.length > 0 ? args.name : args.official.name;
    this.icon = args.icon ?? args.official.icon;
  }

  /** Lazily obtain (and cache) the official provider — deferred off the init/SSR path.
   *  `official.provider()` is typed `OfficialProvider` (loose `request` so real
   *  official adapters are assignable); it is call-compatible with CIP0103Provider
   *  (the bridge only ever calls `request({ method, params })`). */
  private get provider(): CIP0103Provider {
    if (this.providerInstance === null) {
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
