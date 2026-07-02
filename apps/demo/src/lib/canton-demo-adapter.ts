/**
 * Demo-only adapter that wraps the fixture provider injected by
 * `apps/demo/public/mock-cip0103-wallet.js` at `window.canton.demoWallet`.
 *
 * The fixture is gated to `NODE_ENV !== 'production'` (see app/layout.tsx),
 * so this adapter only meaningfully runs in dev / Playwright. In a
 * production build there is no fixture and `detectInstalled()` returns
 * `installed: false` — registering the adapter is harmless either way.
 *
 * Why this lives in the demo and not in any `@partylayer/*` package:
 * the published SDK ships only real wallet adapters (Console, Loop,
 * Cantor8, Nightly, Send, Bron). The Canton Demo Wallet is a test
 * fixture, not a real wallet. Pre-Prompt-7.6 the modal scanned
 * `window.canton.*` and synthesized a generic entry for the fixture;
 * 7.6 deleted that synthesis path. The clean replacement is a real
 * adapter the demo registers itself, talking the canonical
 * `WalletAdapter` contract end to end.
 *
 * The fixture's RPC method surface is documented at the top of
 * `mock-cip0103-wallet.js`. This adapter wraps it 1:1; methods the
 * fixture doesn't implement (`signTransaction`, `submitTransaction`,
 * `ledgerApi`) are simply not declared as capabilities and not added
 * to the adapter — `capabilityGuard()` in the SDK refuses calls to
 * undeclared capabilities, which is the correct user-facing behaviour.
 */

import {
  toPartyId,
  toSignature,
  toWalletId,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type PersistedSession,
  type Session,
  type SignMessageParams,
  type SignedMessage,
  type WalletAdapter,
} from '@partylayer/core';
import { getBuiltinAdapters, type OfficialProviderAdapter, type OfficialAdapterFactory } from '@partylayer/sdk';
import { WalleyAdapter } from '@k2flabs/walley-dapp-sdk';
import { buildWalletConnectAdapter } from './walletconnect-demo';
import { sortByCanonicalOrder } from './wallet-order';

const WALLET_ID = 'canton-demo';
const WALLET_NAME = 'Canton Demo Wallet';

const DEMO_CAPABILITIES: CapabilityKey[] = [
  'connect',
  'disconnect',
  'restore',
  'signMessage',
  'injected',
];

interface DemoStatusResponse {
  provider: { id: string; version: string; providerType: string };
  network: { id: string; name: string };
  session: { userId: string; isConnected: boolean } | null;
}

interface DemoConnectResponse {
  isConnected: boolean;
  userId: string;
}

interface DemoAccountResponse {
  partyId: string;
  address: string;
  namespace: string;
}

interface DemoProvider {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

function readProvider(): DemoProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    canton?: { demoWallet?: DemoProvider };
    __plDemoMock?: DemoProvider;
  };
  // Canonical namespace first; then the demo-owned fallback the mock script
  // always publishes. A REAL extension can own window.canton (frozen or
  // replaced after page scripts), in which case the mock cannot attach there;
  // the fallback keeps the demo wallet discoverable without fighting the
  // extension. Both sides of this channel are demo-only code.
  const demo = w.canton?.demoWallet ?? w.__plDemoMock;
  if (!demo || typeof demo.request !== 'function') return null;
  return demo;
}

export class CantonDemoWalletAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLET_ID);
  readonly name = WALLET_NAME;

  getCapabilities(): CapabilityKey[] {
    return DEMO_CAPABILITIES;
  }

  async detectInstalled(): Promise<AdapterDetectResult> {
    if (typeof window === 'undefined') {
      return { installed: false, reason: 'Browser environment required' };
    }
    if (!readProvider()) {
      return {
        installed: false,
        reason:
          'Canton Demo Wallet fixture not present. This adapter is dev-only and requires the mock-cip0103-wallet.js script.',
      };
    }
    return { installed: true, reason: 'Canton Demo Wallet fixture detected' };
  }

  async connect(ctx: AdapterContext): Promise<AdapterConnectResult> {
    const provider = readProvider();
    if (!provider) {
      throw new Error('Canton Demo Wallet fixture not available');
    }
    const status = (await provider.request({ method: 'connect' })) as DemoConnectResponse;
    if (!status.isConnected) {
      throw new Error('Canton Demo Wallet refused connect');
    }
    const account = (await provider.request({ method: 'getPrimaryAccount' })) as DemoAccountResponse;
    return {
      partyId: toPartyId(account.partyId),
      session: {
        walletId: this.walletId,
        network: ctx.network,
        createdAt: Date.now(),
        metadata: {
          address: account.address,
          namespace: account.namespace,
          fixture: 'mock-cip0103-wallet.js',
        },
      },
      capabilities: this.getCapabilities(),
    };
  }

  async disconnect(_ctx: AdapterContext, _session: Session): Promise<void> {
    const provider = readProvider();
    if (!provider) return;
    await provider.request({ method: 'disconnect' });
  }

  async restore(_ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null> {
    const provider = readProvider();
    if (!provider) return null;

    const status = (await provider.request({ method: 'status' })) as DemoStatusResponse;
    if (!status.session?.isConnected) return null;

    const account = (await provider.request({ method: 'getPrimaryAccount' })) as DemoAccountResponse;
    if (account.partyId !== persisted.partyId) return null;

    return {
      ...persisted,
      walletId: this.walletId,
      metadata: {
        ...(persisted.metadata ?? {}),
        address: account.address,
        namespace: account.namespace,
        fixture: 'mock-cip0103-wallet.js',
      },
    };
  }

  async signMessage(
    _ctx: AdapterContext,
    session: Session,
    params: SignMessageParams,
  ): Promise<SignedMessage> {
    const provider = readProvider();
    if (!provider) {
      throw new Error('Canton Demo Wallet fixture not available');
    }
    if (typeof params.message !== 'string' || params.message.length === 0) {
      throw new Error('signMessage requires a non-empty string `message`');
    }
    const signature = (await provider.request({
      method: 'signMessage',
      params: { message: params.message },
    })) as string;
    return {
      signature: toSignature(signature),
      partyId: session.partyId,
      message: params.message,
      nonce: params.nonce,
      domain: params.domain,
    };
  }
}

/**
 * Demo's canonical adapter list. Equal to `getBuiltinAdapters()` in
 * production; in dev / Playwright it also registers the
 * CantonDemoWalletAdapter so the fixture-backed test wallet surfaces
 * in the picker.
 */
export function buildDemoAdapters(): (WalletAdapter | OfficialProviderAdapter | OfficialAdapterFactory)[] {
  // Opt-in WalletConnect (live mobile-wallet scan). Registering it surfaces
  // "WalletConnect" in the picker; its dapp-sdk barrel only loads at connect.
  const adapters: (WalletAdapter | OfficialProviderAdapter | OfficialAdapterFactory)[] = [
    ...getBuiltinAdapters(),
    buildWalletConnectAdapter(),
    // Walley — popup/remote wallet. FACTORY form: the SDK resolves the host from
    // the registry entry's adapter.networkHosts for the active network (no
    // hardcoded URL) and constructs the official adapter with it. No
    // @partylayer/adapter-walley package. Validated against real dev.walley.cc
    // by the walley E2E (devnet host resolved from the registry entry).
    { providerId: 'walley', create: (host: string) => new WalleyAdapter({ host }) },
  ];
  if (process.env.NODE_ENV !== 'production') {
    adapters.push(new CantonDemoWalletAdapter());
  }
  // Canonical order shared across every demo-rendered wallet list.
  return sortByCanonicalOrder(adapters, (a) =>
    String((a as { walletId?: unknown }).walletId ?? (a as OfficialProviderAdapter).providerId),
  );
}
