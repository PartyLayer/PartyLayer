/**
 * Generic network-driven host resolution for discovery-adapter wallets
 * (OfficialAdapterFactory). Proves:
 *  - host SELECTION: factory.create() receives networkHosts[activeNetwork];
 *  - OVERRIDE precedence: a pre-constructed instance ignores networkHosts;
 *  - CLEAR failures: no networkHosts / missing active network → named errors;
 *  - GESTURE SURVIVAL: with the factory form, the host is resolved + the official
 *    constructed DURING warm-up (prepareConnect), so the prepared connect reaches
 *    adapter.connect() with NO awaited re-listing (window.open survives the gesture).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters transitively (Console SDK imports
// SVGs that explode under Node) — stub at the boundary.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  WalletNotFoundError,
  type CIP0103Provider,
  type OfficialAdapterFactory,
  type OfficialProviderAdapter,
} from '@partylayer/core';
import { createPartyLayer } from './client';

const WALLEY = toWalletId('walley');
const NETWORK_HOSTS = {
  devnet: 'https://dev.walley.cc',
  testnet: 'https://staging.walley.cc',
  mainnet: 'https://walley.cc',
};

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

function makeOfficialAt(_host: string): OfficialProviderAdapter {
  const provider = eventlessProvider();
  return {
    providerId: 'walley',
    name: 'Walley',
    type: 'browser',
    detect: vi.fn(async () => true),
    provider: vi.fn(() => provider),
  } as OfficialProviderAdapter;
}

/** Factory form: records the host it is asked to build with. */
function makeFactory() {
  const create = vi.fn((host: string) => makeOfficialAt(host));
  const factory: OfficialAdapterFactory = { providerId: 'walley', name: 'Walley', create };
  return { factory, create };
}

/** Pre-constructed instance form, bound to an explicit host (the override case). */
function makeInstance(): OfficialProviderAdapter & { provider: ReturnType<typeof vi.fn> } {
  const provider = eventlessProvider();
  return {
    providerId: 'walley',
    name: 'Walley',
    type: 'browser',
    detect: vi.fn(async () => true),
    provider: vi.fn(() => provider),
  } as OfficialProviderAdapter & { provider: ReturnType<typeof vi.fn> };
}

function makeClient(
  network: 'devnet' | 'testnet' | 'mainnet',
  adapters: unknown[],
  opts: { networkHosts?: Record<string, string>; inRegistry?: boolean } = {},
) {
  const { networkHosts = NETWORK_HOSTS, inRegistry = true } = opts;
  const client = createPartyLayer({
    network,
    app: { name: 'factory test', origin: 'https://test.example.com' },
    adapters: adapters as never,
  });
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([]);
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({
    metadata: { registryVersion: '1', schemaVersion: '1', publishedAt: 'x', channel: 'stable', sequence: 1 },
    wallets: [],
  } as never);
  const getWalletEntry = vi.spyOn(client.registryClient, 'getWalletEntry');
  if (inRegistry) {
    getWalletEntry.mockResolvedValue({
      id: 'walley',
      name: 'Walley',
      supportedNetworks: ['devnet', 'testnet', 'mainnet'],
      capabilities: { signMessage: true, signTransaction: false, submitTransaction: true, transactionStatus: true, switchNetwork: false, multiParty: false },
      adapter: { type: '@k2flabs/walley-dapp-sdk', transport: 'discovery-adapter', config: { providerId: 'walley' }, networkHosts },
    } as never);
  } else {
    getWalletEntry.mockRejectedValue(new WalletNotFoundError('not-in-registry'));
  }
  return client;
}

describe('generic network-driven host resolution (OfficialAdapterFactory)', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['devnet', 'https://dev.walley.cc'],
    ['testnet', 'https://staging.walley.cc'],
    ['mainnet', 'https://walley.cc'],
  ] as const)('SELECTION: on %s the factory builds with networkHosts host %s', async (network, host) => {
    const { factory, create } = makeFactory();
    const client = makeClient(network, [factory]);
    const session = await client.connect({ walletId: WALLEY });
    expect(session.walletId).toBe(WALLEY);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(host);
  });

  it('OVERRIDE: a pre-constructed instance ignores networkHosts (explicit host wins)', async () => {
    const instance = makeInstance();
    // Even though the registry advertises networkHosts, an instance form has its
    // own baked host — networkHosts must not be consulted (no factory to call).
    const client = makeClient('mainnet', [instance]);
    const session = await client.connect({ walletId: WALLEY });
    expect(session.walletId).toBe(WALLEY);
    const req = (instance.provider() as CIP0103Provider).request as ReturnType<typeof vi.fn>;
    expect(req.mock.calls.some((c) => c[0].method === 'connect')).toBe(true);
  });

  it('CLEAR FAILURE: factory + no networkHosts for the wallet → named error', async () => {
    const { factory } = makeFactory();
    const client = makeClient('mainnet', [factory], { networkHosts: {} });
    await expect(client.connect({ walletId: WALLEY })).rejects.toThrow(/no host for network "mainnet"/);
  });

  it('CLEAR FAILURE: networkHosts lacks the active network → names the unsupported network', async () => {
    const { factory } = makeFactory();
    const client = makeClient('mainnet', [factory], {
      networkHosts: { devnet: 'https://dev.walley.cc', testnet: 'https://staging.walley.cc' },
    });
    await expect(client.connect({ walletId: WALLEY })).rejects.toThrow(/no host for network "mainnet"/);
  });

  it('GESTURE SURVIVAL: host resolved + official built during prepareConnect; prepared connect does NOT re-list', async () => {
    const { factory, create } = makeFactory();
    const client = makeClient('mainnet', [factory]);
    const getWallets = client.registryClient.getWallets as unknown as ReturnType<typeof vi.fn>;

    const prepared = await client.prepareConnect({ walletId: WALLEY });
    // Host resolution + factory.create happened during the async prepare phase…
    expect(create).toHaveBeenCalledWith('https://walley.cc');
    expect(getWallets).toHaveBeenCalled();

    getWallets.mockClear();
    create.mockClear();
    await prepared.connect();

    // …so the (gesture-synchronous) prepared connect re-lists nothing and does
    // NOT re-create the official — zero awaited ops precede adapter.connect().
    expect(getWallets).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
