// @vitest-environment jsdom
/** A rejected native cache migration emits the original session id once. */
import { describe, it, expect, vi } from 'vitest';
import type { WalletAdapter, Storage, WalletInfo } from '@partylayer/core';
import { toWalletId, toPartyId } from '@partylayer/core';

// vi.mock factories are hoisted above module-level consts, so anything they
// reference has to be hoisted with them.
const { ANNOUNCE_ID, WALLET_ID, PARTY, announcedProvider } = vi.hoisted(() => {
  const ANNOUNCE_ID = 'browser:ext:announce-under-test';
  const WALLET_ID = 'announce-under-test';
  const PARTY = 'party::announce';
  /** The announced wallet's provider. `status` is the lever that picks the branch. */
  const announcedProvider = {
    request: async ({ method }: { method: string }) => {
      // An EXPLICIT disconnected signal is what makes GenericAnnounceAdapter's
      // restore() return null (announce-adapter.ts:380), which is the branch
      // that reaches the emit under test.
      if (method === 'status') return { isConnected: false };
      if (method === 'getPrimaryAccount') return { partyId: PARTY };
      return {};
    },
    on: () => {},
    removeListener: () => {},
    emit: () => {},
  };
  return { ANNOUNCE_ID, WALLET_ID, PARTY, announcedProvider };
});

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

vi.mock('@partylayer/provider', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/provider')>('@partylayer/provider');
  return {
    ...actual,
    // One announced wallet, identity resolved so it is not skipped at :577.
    discoverProviders: async () => [
      {
        id: ANNOUNCE_ID,
        name: 'Announce Under Test',
        provider: announcedProvider,
        identityResolved: true,
      },
    ],
    createExtensionChannelProvider: () => announcedProvider,
    subscribeAnnouncedProviders: () => () => {},
  };
});

vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>(
    '@partylayer/registry-client',
  );
  const core = await vi.importActual<typeof import('@partylayer/core')>('@partylayer/core');

  // The registry entry that makes this an announce wallet WITH a restore probe.
  // Both matter: transport gates the branch at :596, config.restore is what puts
  // a `restore` method on the adapter at announce-adapter.ts:211.
  const entry = {
    id: WALLET_ID,
    name: 'Announce Under Test',
    supportedNetworks: ['devnet'],
    capabilities: { signMessage: true, signTransaction: false, submitTransaction: true, transactionStatus: false, switchNetwork: false, multiParty: false },
    adapter: { type: '@partylayer/adapter-announce-under-test', transport: 'announce', config: { restore: true } },
    installation: { windowProperty: 'cantonUnderTest' },
    sdkVersion: '>=0.1.0',
  };

  const walletInfo: WalletInfo = {
    walletId: core.toWalletId(WALLET_ID),
    name: 'Announce Under Test',
    website: '',
    icons: {},
    capabilities: ['connect', 'disconnect', 'restore'],
    adapter: { packageName: entry.adapter.type, versionRange: '*' },
    docs: [],
    networks: ['devnet'],
    channel: 'stable',
    // Identity bridge: findMatchingWalletInfo maps the announced id to this entry.
    providerDetection: {
      transport: 'window.canton',
      matchers: [{ field: 'provider.id', match: 'exact', values: [ANNOUNCE_ID] }],
    },
  } as unknown as WalletInfo;

  class AnnounceRegistryClient {
    async getWallets() { return [walletInfo]; }
    async listWallets() { return [walletInfo]; }
    async getWalletEntry(id: string) {
      if (id === WALLET_ID) return entry;
      throw new core.WalletNotFoundError(id);
    }
    async getRegistry() { return { wallets: [entry], metadata: {} }; }
    async refreshRegistry() { return { wallets: [entry], metadata: {} }; }
    getStatus() { return { state: 'offline', lastFetchAt: null, lastError: null }; }
    onStatusChange() { return () => {}; }
  }
  return { ...actual, RegistryClient: AnnounceRegistryClient };
});

import { createPartyLayer } from './index';

function makeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    async get(k: string) { return data.get(k) ?? null; },
    async set(k: string, v: string) { data.set(k, v); },
    async remove(k: string) { data.delete(k); },
    async clear() { data.clear(); },
  } as Storage;
}

/** Only used to seed a persisted session for a wallet the second client cannot serve. */
class SeedAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLET_ID);
  readonly name = 'Seed';
  getCapabilities() {
    return ['connect', 'disconnect'] as ReturnType<WalletAdapter['getCapabilities']>;
  }
  async detectInstalled() { return { installed: true }; }
  async connect() {
    return {
      partyId: toPartyId(PARTY),
      session: {
        walletId: this.walletId,
        network: 'devnet' as const,
        createdAt: Date.now(),
        metadata: {},
      },
      capabilities: ['connect'] as ReturnType<WalletAdapter['getCapabilities']>,
    };
  }
  async disconnect() {}
  // Deliberately NO restore: forces the as-is revive that sets the probe flag.
  restore?: undefined;
}

describe('native cache migration expiry', () => {
  it('emits the discarded cache session id and never exposes the unverified party', async () => {
    localStorage.clear();
    const storage = makeStorage();
    const seed = createPartyLayer({
      network: 'devnet', app: { name: 'migration', origin: 'https://reprobe.example' },
      adapters: [new SeedAdapter()], storage,
    });
    const original = await seed.connect({ walletId: toWalletId(WALLET_ID) });
    seed.destroy();
    const client = createPartyLayer({
      network: 'devnet', app: { name: 'migration', origin: 'https://reprobe.example' },
      adapters: [], storage,
    });
    const expired = vi.fn(); client.on('session:expired', expired);
    expect(await client.getActiveSession()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledWith(expect.objectContaining({ sessionId: original.sessionId }));
    expect(await storage.get('active_session')).toBeNull();
    await expect(client.listWallets()).resolves.toBeDefined();
    expect(await client.getActiveSession()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    client.destroy();
  });
});
