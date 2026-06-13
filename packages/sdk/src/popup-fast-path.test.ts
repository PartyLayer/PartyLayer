/**
 * Popup-safe connect fast-path — regression guards.
 *
 * Two invariants:
 *  1. Gesture survival: for a popup/remote (GenericDiscoveryAdapter) wallet, the
 *     connect path reaches `adapter.connect()` with NO awaited guards in between
 *     (so the wallet's window.open survives the user gesture). Proven by spying
 *     that `listWallets`/`getWallets` is NOT re-run during the fast/prepared
 *     connect.
 *  2. Behavior parity: a normal (injected/announce) wallet ALWAYS takes the
 *     slow path (guards re-run), and a cold cache for a discovery wallet falls
 *     back to the slow path. (The full SDK suite passing is the broader parity
 *     guard.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// createPartyLayer imports getBuiltinAdapters transitively (Console SDK imports
// SVGs that explode under Node) — stub at the module boundary.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  toPartyId,
  WalletNotFoundError,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type CIP0103Provider,
  type OfficialProviderAdapter,
  type WalletAdapter,
} from '@partylayer/core';
import { createPartyLayer } from './client';

function eventlessProvider(): CIP0103Provider {
  const handlers: Record<string, unknown> = {
    connect: { isConnected: true },
    getPrimaryAccount: { partyId: 'party::walley-1', networkId: 'canton:da-devnet' },
    status: { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } },
    disconnect: null,
  };
  const provider: CIP0103Provider = {
    request: vi.fn(async (args: { method: string }) => handlers[args.method]) as CIP0103Provider['request'],
    on: () => provider,
    emit: () => false,
    removeListener: () => provider,
  };
  return provider;
}

/** Walley-shaped official adapter (eventless popup/remote). */
function makeOfficial(): OfficialProviderAdapter & { provider: ReturnType<typeof vi.fn> } {
  const provider = eventlessProvider();
  return {
    providerId: 'walley',
    name: 'Walley',
    type: 'browser',
    detect: vi.fn(async () => true),
    provider: vi.fn(() => provider),
  } as OfficialProviderAdapter & { provider: ReturnType<typeof vi.fn> };
}

/** A normal injected-style WalletAdapter (NOT a discovery adapter). */
class NormalAdapter implements WalletAdapter {
  readonly walletId = toWalletId('normal');
  readonly name = 'Normal';
  connect = vi.fn(
    async (_ctx: AdapterContext): Promise<AdapterConnectResult> => ({
      partyId: toPartyId('party::normal-1'),
      session: { walletId: this.walletId },
      capabilities: this.getCapabilities(),
    }),
  );
  getCapabilities(): CapabilityKey[] {
    return ['connect'];
  }
  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true };
  }
  async disconnect(): Promise<void> {}
}

function makeClient() {
  const official = makeOfficial();
  const normal = new NormalAdapter();
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'popup-fast-path test', origin: 'https://test.example.com' },
    adapters: [official, normal],
  });
  // Hermetic registry: no network. No registry entries → wallets are
  // adapter-merged; getWalletEntry throws WalletNotFoundError (origin check skipped).
  const getWallets = vi
    .spyOn(client.registryClient, 'getWallets')
    .mockResolvedValue([]);
  vi.spyOn(client.registryClient, 'getWalletEntry').mockRejectedValue(
    new WalletNotFoundError('not-in-registry'),
  );
  return { client, official, normal, getWallets };
}

const WALLEY = toWalletId('walley');

describe('popup-safe connect fast-path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prepareConnect resolves guards up-front; connect() then reaches adapter.connect with NO re-listing (gesture survival)', async () => {
    const { client, official, getWallets } = makeClient();

    const prepared = await client.prepareConnect({ walletId: WALLEY });
    expect(prepared.walletId).toBe(WALLEY);
    expect(getWallets).toHaveBeenCalled(); // guards resolved during prepare

    getWallets.mockClear();
    await prepared.connect();

    // The prepared connect must NOT re-run wallet listing — proving zero awaited
    // guards precede adapter.connect().
    expect(getWallets).not.toHaveBeenCalled();
    const req = (official.provider() as CIP0103Provider).request as ReturnType<typeof vi.fn>;
    expect(req.mock.calls.some((c) => c[0].method === 'connect')).toBe(true);
  });

  it('after listWallets warms the plan, connect() fast-paths (no re-listing)', async () => {
    const { client, official, getWallets } = makeClient();

    await client.listWallets({ includeExperimental: true });
    // Warm-up is fire-and-forget; it runs the install guard (official.detect).
    await vi.waitFor(() => expect(official.detect).toHaveBeenCalled());

    getWallets.mockClear();
    const session = await client.connect({ walletId: WALLEY });

    expect(session.walletId).toBe(WALLEY);
    expect(getWallets).not.toHaveBeenCalled(); // fast-path consumed the warm plan
  });

  it('PARITY: a normal (non-discovery) wallet always takes the slow path (re-lists)', async () => {
    const { client, getWallets } = makeClient();

    await client.listWallets({ includeExperimental: true }); // would warm only discovery adapters
    getWallets.mockClear();

    await client.connect({ walletId: toWalletId('normal') });
    // Normal wallets never warm/fast-path → connect re-resolves via listWallets.
    expect(getWallets).toHaveBeenCalled();
  });

  it('PARITY: a COLD discovery wallet (no prior listWallets) falls back to the slow path', async () => {
    const { client, getWallets } = makeClient();
    // No listWallets() call → no warm plan.
    await client.connect({ walletId: WALLEY });
    expect(getWallets).toHaveBeenCalled(); // slow path resolved the plan inline
  });
});
