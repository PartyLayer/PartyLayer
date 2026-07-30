/**
 * Cantor8 (C8) Wallet Adapter
 *
 * Wraps the wallet's OWN SDK, `@cantor8/wallet-connect-sdk` (`C8WalletProvider`),
 * which opens a popup to the hosted Cantor8 wallet and speaks its own popup +
 * `postMessage` protocol.
 *
 * This is NOT CIP-0103: the SDK exposes no `request({ method })`, no
 * `signMessage`, and no `prepareExecute`, and it discovers itself over a
 * proprietary `c8#provider_discovery` window event rather than
 * `canton:announceProvider`. Until Cantor8 ships an official `ProviderAdapter`
 * (the generic discovery path), a bespoke wrapper on the real SDK is the honest
 * way to integrate it, replacing the previous `cantor8://` deep-link stub.
 *
 * What maps to a real SDK method, and what does not:
 * - `connect`  → `C8WalletProvider.connect()` + `getAccounts()` for the party.
 * - `disconnect` → `C8WalletProvider.disconnect()`.
 * - `submitTransaction` → `signAndExecute()` (the SDK fuses sign + execute).
 * - tx status → the SDK's `txChanged` event, surfaced as the `events` capability
 *   via `on('txStatus')`.
 * - `signMessage` has NO counterpart in the SDK. It is NOT simulated, NOT routed
 *   through a transaction method, and does NOT silently succeed. It fails with
 *   `CapabilityNotSupportedError`.
 * - The SDK's networks are `devnet` and `mainnet` only.
 *
 * Reference: `@cantor8/wallet-connect-sdk` (npm, 0.4.0); docs at cantor8.mintlify.app.
 */

import type {
  WalletAdapter,
  AdapterContext,
  AdapterDetectResult,
  AdapterConnectResult,
  AdapterEventName,
  SignMessageParams,
  SubmitTransactionParams,
  Session,
  SignedMessage,
  TxReceipt,
} from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
  toTransactionHash,
  CapabilityNotSupportedError,
  mapUnknownErrorToPartyLayerError,
  type CapabilityKey,
} from '@partylayer/core';

// Lazy, SSR-safe access to the wallet's own SDK: the provider touches `window`
// (it opens a popup), so the import is deferred to first use, mirroring the
// Console adapter. `@cantor8/wallet-connect-sdk` has zero dependencies.
type C8Module = typeof import('@cantor8/wallet-connect-sdk');
type C8WalletProviderInstance = InstanceType<C8Module['C8WalletProvider']>;

let c8ModulePromise: Promise<C8Module> | null = null;
function loadC8(): Promise<C8Module> {
  if (!c8ModulePromise) {
    c8ModulePromise = import('@cantor8/wallet-connect-sdk');
  }
  return c8ModulePromise;
}

/** The only networks the Cantor8 SDK constructor accepts. */
type C8Network = 'devnet' | 'mainnet';

/**
 * The shape `submitTransaction` expects in `params.signedTx`: the Cantor8 SDK's
 * `signAndExecute` input. The caller owns this shape (passthrough).
 */
export interface Cantor8SubmitPayload {
  note?: string;
  partyId: string;
  commandId: string;
  commandsJson: string;
  disclosedContracts?: string;
}

/**
 * Cantor8 adapter configuration.
 */
export interface Cantor8AdapterConfig {
  /** dApp URL passed to the Cantor8 SDK popup handshake. Defaults to `ctx.origin`. */
  dappUrl?: string;
}

/**
 * Cantor8 Wallet Adapter.
 */
export class Cantor8Adapter implements WalletAdapter {
  readonly walletId = toWalletId('cantor8');
  readonly name = 'Cantor8';

  private readonly config: Cantor8AdapterConfig;
  private provider: C8WalletProviderInstance | null = null;

  constructor(config: Cantor8AdapterConfig = {}) {
    this.config = config;
  }

  getCapabilities(): CapabilityKey[] {
    // No 'signMessage' (the SDK has none) and no 'signTransaction' (the SDK only
    // fuses sign + execute via signAndExecute). Tx status is delivered as events.
    return ['connect', 'disconnect', 'submitTransaction', 'events', 'popup'];
  }

  /** The SDK supports devnet and mainnet only; anything else fails at connect. */
  private mapNetwork(network: string): C8Network {
    if (network === 'devnet') return 'devnet';
    if (network === 'mainnet') return 'mainnet';
    throw new Error(
      `Cantor8 does not support the "${network}" network (supported: devnet, mainnet).`,
    );
  }

  /**
   * Cantor8 is a HOSTED POPUP wallet: connect() opens the wallet at
   * wallet.dev.digik.cantor8.tech (devnet) or wallet.cantor8.tech (mainnet)
   * through the SDK's C8WalletProvider. Nothing of Cantor8 runs in THIS page, so
   * there is nothing here to detect.
   *
   * The SDK's discovery protocol has two sides. `announceC8Provider(get)` is the
   * DISPATCH side, called by a wallet that lives in the page to advertise a
   * provider factory; `onC8ProviderDiscovered(cb)` is the SUBSCRIBE side, called
   * by a dApp to hear such an announcement. A hosted popup on another origin never
   * calls `announceC8Provider` in our page, so subscribing and waiting for the
   * `c8#provider_discovery` event can only ever time out. That is precisely what
   * the previous strategy did, and it reported Cantor8 permanently unavailable,
   * which hid it from the picker.
   *
   * The right model is the gateway contract the official ProviderAdapter path uses
   * (see GenericDiscoveryAdapter.detectInstalled): a gateway is reachable wherever
   * it can be opened, so detect reports available and the REAL availability check
   * happens at connect(), when the popup opens. Walley, a popup wallet on that
   * generic path, works in our demos for exactly this reason.
   *
   * This is the SECOND detection strategy to be wrong here, both from the same
   * root cause: inferring the wallet's shape without the wallet in hand. First a
   * user-agent sniff mislabeled this desktop popup as a mobile wallet; then the
   * announcement wait assumed an in-page announcer that a hosted popup never
   * provides. Do not reintroduce a probe that depends on something being in the
   * page. If a future in-page Cantor8 ever announces over `c8#provider_discovery`,
   * it may be adopted as a fast path, but it must NEVER be the condition for
   * availability.
   *
   * detect still LOADS the SDK (the pre-fix detect did too; only its announcement
   * wait was wrong). This is deliberate warming, not detection: a bespoke adapter
   * does not get the SDK's popup-safe fast-path (that is for GenericDiscoveryAdapter),
   * so connect() reaches window.open only after awaits. detect runs at picker
   * render, off the click gesture, so the dynamic import resolves before the user
   * clicks; connect()'s `await loadC8()` is then a resolved microtask instead of a
   * cold import that would defer window.open past the gesture and let the browser
   * block the popup.
   */
  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }
    // Warm the SDK module (see the warming note above). A load failure is not
    // fatal to availability; it surfaces at connect() where the real work happens.
    try {
      await loadC8();
    } catch {
      /* ignore; connect() surfaces a genuine SDK load failure */
    }
    return { installed: true };
  }

  async connect(
    ctx: AdapterContext,
    _opts?: { timeoutMs?: number },
  ): Promise<AdapterConnectResult> {
    try {
      const { C8WalletProvider } = await loadC8();
      const provider = new C8WalletProvider({
        dappName: ctx.appName,
        dappUrl: this.config.dappUrl ?? ctx.origin,
        network: this.mapNetwork(ctx.network),
      });
      // Cantor8's connect() resolves void; the party is read from getAccounts().
      await provider.connect();
      const { accounts } = await provider.getAccounts();
      const partyId = accounts?.[0]?.partyId;
      if (!partyId) {
        throw new Error('Cantor8 returned no account after connect');
      }
      this.provider = provider;
      return {
        partyId: toPartyId(partyId),
        session: {
          walletId: this.walletId,
          // Cantor8's connect carries no network → echo the requested one.
          network: ctx.network,
          createdAt: Date.now(),
        },
        capabilities: this.getCapabilities(),
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'connect',
        transport: 'popup',
      });
    }
  }

  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    if (!this.provider) return;
    try {
      await this.provider.disconnect();
    } finally {
      this.provider = null;
    }
  }

  /**
   * Cantor8 has NO arbitrary-message signing. Per the honesty rule: do not
   * simulate it, do not route it through `signAndExecute` (which is for
   * transactions), and do not silently succeed. Fail with the typed capability
   * error. `signMessage` is also absent from `getCapabilities()`, so the SDK's
   * capability guard blocks it first; this is the belt-and-suspenders backstop.
   */
  signMessage(
    _ctx: AdapterContext,
    _session: Session,
    _params: SignMessageParams,
  ): Promise<SignedMessage> {
    return Promise.reject(
      new CapabilityNotSupportedError(String(this.walletId), 'signMessage'),
    );
  }

  /**
   * Submit a transaction through the SDK's `signAndExecute` (sign + execute
   * fused; the wallet has no separate sign step). `params.signedTx` is passed
   * through: the caller owns its shape, which must be a {@link Cantor8SubmitPayload}.
   *
   * The SDK's `signAndExecute` resolves with no id; Cantor8 delivers the
   * on-ledger txId and status asynchronously via the `txChanged` event (surfaced
   * through `on('txStatus')`). The receipt is therefore keyed on the
   * caller-supplied `commandId`; the confirmed ledger id arrives on the event
   * stream. A live run against the real wallet is required to confirm
   * end-to-end execution.
   */
  async submitTransaction(
    _ctx: AdapterContext,
    _session: Session,
    params: SubmitTransactionParams,
  ): Promise<TxReceipt> {
    try {
      if (!this.provider) {
        throw new Error('Not connected to Cantor8');
      }
      const input = params.signedTx as Cantor8SubmitPayload;
      if (
        !input ||
        typeof input.commandId !== 'string' ||
        typeof input.commandsJson !== 'string' ||
        typeof input.partyId !== 'string'
      ) {
        throw new Error(
          'Cantor8 submitTransaction requires signedTx to be the SDK signAndExecute '
            + 'input { note?, partyId, commandId, commandsJson, disclosedContracts? }.',
        );
      }
      await this.provider.signAndExecute({
        note: input.note ?? '',
        partyId: input.partyId,
        commandId: input.commandId,
        commandsJson: input.commandsJson,
        disclosedContracts: input.disclosedContracts ?? '',
      });
      // signAndExecute returns no id; key the receipt on the caller's commandId.
      // The confirmed ledger txId + status arrive via the txChanged event.
      return {
        transactionHash: toTransactionHash(input.commandId),
        submittedAt: Date.now(),
        commandId: input.commandId,
      };
    } catch (err) {
      throw mapUnknownErrorToPartyLayerError(err, {
        walletId: this.walletId,
        phase: 'submitTransaction',
        transport: 'popup',
      });
    }
  }

  /**
   * Forward the wallet's transaction-status stream. Cantor8 emits `txChanged`
   * ({ txId, status }); PartyLayer surfaces this as the `events` capability under
   * the `txStatus` event. Any other event name is a no-op. Returns an
   * unsubscribe function.
   */
  on(event: AdapterEventName, handler: (payload: unknown) => void): () => void {
    if (event !== 'txStatus' || !this.provider) {
      return () => {
        /* nothing subscribed */
      };
    }
    const off = this.provider.on('txChanged', (e) => {
      handler({ txId: e.txId, status: e.status });
    });
    return () => {
      try {
        off();
      } catch {
        /* ignore */
      }
    };
  }
}
