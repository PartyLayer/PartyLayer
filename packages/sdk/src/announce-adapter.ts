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
 */
import type {
  AdapterConnectResult,
  AdapterContext,
  AdapterDetectResult,
  CapabilityKey,
  CIP0103Account,
  CIP0103Provider,
  NetworkId,
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

export interface GenericAnnounceAdapterArgs {
  /** The announced extension id (== announce `detail.id`). */
  announceId: string;
  /** Display name from the announce detail (falls back to a derived label). */
  name?: string;
  /** Icon (data: URI or URL) from the announce detail. */
  icon?: string;
  /** Target-scoped CIP-0103 provider built from the announce (the discovery result). */
  provider: CIP0103Provider;
}

export class GenericAnnounceAdapter implements WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  /** Icon surfaced to the picker (announce detail). */
  readonly icon?: string;
  private readonly provider: CIP0103Provider;

  constructor(args: GenericAnnounceAdapterArgs) {
    this.walletId = announcedWalletId(args.announceId);
    this.name =
      args.name && args.name.length > 0
        ? args.name
        : `Canton Wallet (${args.announceId.slice(0, 6)}…)`;
    this.icon = args.icon;
    this.provider = args.provider;
  }

  /** Baseline CIP-0103 capabilities every announced wallet must implement. */
  getCapabilities(): CapabilityKey[] {
    return ['connect', 'signMessage', 'submitTransaction'];
  }

  /**
   * The adapter is only ever constructed for a wallet that just announced, so
   * its presence is established by the announce handshake itself.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true, reason: 'Announced via canton:announceProvider' };
  }

  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    // CIP-0103 connect handshake over the target-scoped channel.
    await this.provider.request({ method: 'connect' });
    const account = await this.provider.request<CIP0103Account>({
      method: 'getPrimaryAccount',
    });

    // Wallet-reported network (truthful), per A1b — fall back to dApp config.
    let reportedNetwork: string | undefined;
    try {
      const status = await this.provider.request<{ network?: { networkId?: string } }>({
        method: 'status',
      });
      reportedNetwork = status?.network?.networkId;
    } catch {
      // status is optional for some wallets — fall through to account/config.
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
