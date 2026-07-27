/**
 * Discovery-adapter session survival across reload.
 *
 * The failure is silent, so these tests prove the before and after rather than
 * asserting it. An official-style adapter is modeled on Walley: `provider()`
 * returns a fresh, SESSION-LESS provider (a request throws until connected), and
 * `restore()` returns a LIVE, already-connected provider read from the wallet's
 * own storage.
 *
 * Before the fix the bridge never called `restore`, so on reload it built a
 * session-less provider and the first request threw. After the fix
 * `GenericDiscoveryAdapter.restore` forwards to the official `restore` and adopts
 * the returned live provider, so the first request succeeds. Wallets whose
 * official adapter has no `restore` are unchanged, and the network gate still
 * runs before any adapter handoff.
 */
import { describe, it, expect, vi } from 'vitest';
import type {
  AdapterContext,
  CIP0103Provider,
  OfficialProviderAdapter,
  PersistedSession,
  Session,
  Storage as PLStorage,
} from '@partylayer/core';
import { toPartyId, toWalletId } from '@partylayer/core';
import { GenericDiscoveryAdapter } from './discovery-adapter';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

// Offline registry: the wallet is supplied via config.adapters, no network fetch.
vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>('@partylayer/registry-client');
  const core = await vi.importActual<typeof import('@partylayer/core')>('@partylayer/core');
  class OfflineRegistryClient {
    async getWallets() { return []; }
    async listWallets() { return []; }
    async getWalletEntry(id: string) { throw new core.WalletNotFoundError(id); }
    async getRegistry() { return { wallets: [], metadata: {} }; }
    async refreshRegistry() { return { wallets: [], metadata: {} }; }
    getStatus() { return { state: 'offline', lastFetchAt: null, lastError: null }; }
    onStatusChange() { return () => {}; }
  }
  return { ...actual, RegistryClient: OfflineRegistryClient };
});

import { createPartyLayer } from './index';

/**
 * A CIP-0103 provider that requires a connection: a fresh one is NOT connected,
 * so `getPrimaryAccount`/`signMessage`/`prepareExecute` throw until `connect`
 * runs (mirrors Walley's `requireConnected`). Pass `connected: true` for the
 * live provider `restore()` hands back.
 */
function makeProvider(opts: { connected?: boolean; network?: string } = {}): CIP0103Provider {
  let connected = opts.connected ?? false;
  const net = opts.network ?? 'devnet';
  const p: CIP0103Provider = {
    request: vi.fn(async (args: { method: string }) => {
      switch (args.method) {
        case 'connect':
          connected = true;
          return { isConnected: true };
        case 'disconnect':
          connected = false;
          return null;
        case 'status':
          return { network: { networkId: net }, connection: { isConnected: connected } };
        case 'getPrimaryAccount':
          if (!connected) throw new Error('Not connected');
          return { partyId: 'party::demo-1', networkId: net };
        case 'signMessage':
          if (!connected) throw new Error('Not connected');
          return { signature: 'sig', message: 'm' };
        case 'prepareExecute':
          if (!connected) throw new Error('Not connected');
          return { transactionHash: '0xabc' };
        default:
          return undefined;
      }
    }) as CIP0103Provider['request'],
    on: () => p,
    emit: () => false,
    removeListener: () => p,
  };
  return p;
}

/** An official-style adapter: session-less `provider()`, optional live `restore()`. */
function makeOfficial(opts: { withRestore?: boolean; network?: string } = {}) {
  const network = opts.network ?? 'devnet';
  const live = makeProvider({ connected: true, network });
  const official: OfficialProviderAdapter = {
    providerId: 'walleyish',
    name: 'Walleyish',
    type: 'remote',
    detect: vi.fn(async () => true),
    provider: vi.fn(() => makeProvider({ connected: false, network })) as unknown as OfficialProviderAdapter['provider'],
  };
  const restoreSpy = vi.fn(async () => live);
  if (opts.withRestore) (official as { restore?: unknown }).restore = restoreSpy;
  return { official, restoreSpy };
}

const ctx = { network: 'devnet' } as unknown as AdapterContext;
const persisted = {
  walletId: toWalletId('walleyish'),
  partyId: toPartyId('party::demo-1'),
  network: 'devnet',
  createdAt: 0,
  encrypted: '',
} as unknown as PersistedSession;

function makeStorage(): PLStorage {
  const data = new Map<string, string>();
  return {
    async get(k) {
      return data.get(k) ?? null;
    },
    async set(k, v) {
      data.set(k, v);
    },
    async remove(k) {
      data.delete(k);
    },
    async clear() {
      data.clear();
    },
  } as PLStorage;
}

const ORIGIN = 'https://test.example.com';
const WID = toWalletId('walleyish');

describe('discovery-adapter session survives reload (unit: before vs after)', () => {
  it('BEFORE restore: provider() is session-less, so the first request throws', async () => {
    const { official } = makeOfficial({ withRestore: true });
    const a = new GenericDiscoveryAdapter({ official });
    // No restore() call yet: this is what a reload did before the fix, using provider().
    await expect(a.signMessage(ctx, {} as Session, { message: 'm' })).rejects.toThrow(/not connected/i);
  });

  it('AFTER restore: adopts the official live provider, so the first request succeeds', async () => {
    const { official, restoreSpy } = makeOfficial({ withRestore: true });
    const a = new GenericDiscoveryAdapter({ official });
    const restored = await a.restore(ctx, persisted);
    expect(restored).not.toBeNull();
    expect(restoreSpy).toHaveBeenCalledTimes(1);
    await expect(a.signMessage(ctx, restored as Session, { message: 'm' })).resolves.toMatchObject({
      signature: 'sig',
    });
  });

  it('no official restore: falls through to as-is, first request still throws (unchanged)', async () => {
    const { official } = makeOfficial({ withRestore: false });
    const a = new GenericDiscoveryAdapter({ official });
    const restored = await a.restore(ctx, persisted);
    expect(restored).not.toBeNull(); // revived as-is, as before
    await expect(a.signMessage(ctx, restored as Session, { message: 'm' })).rejects.toThrow(/not connected/i);
  });
});

describe('discovery-adapter session survives reload (through the SDK reload path)', () => {
  async function seed(storage: PLStorage, official: OfficialProviderAdapter, config = 'devnet') {
    const a = createPartyLayer({
      network: config as never,
      app: { name: 'discovery-restore', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [official as never],
      storage,
    });
    await a.connect({ walletId: WID });
    await a.destroy();
  }

  it('a restore-bearing official adapter survives reload: signMessage succeeds', async () => {
    const storage = makeStorage();
    const { official: seedAdapter } = makeOfficial({ withRestore: true });
    await seed(storage, seedAdapter);

    // Reload: a fresh client over the same storage.
    const { official: reloadAdapter, restoreSpy } = makeOfficial({ withRestore: true });
    const b = createPartyLayer({
      network: 'devnet',
      app: { name: 'discovery-restore', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [reloadAdapter as never],
      storage,
    });
    await new Promise((r) => setTimeout(r, 60)); // let the constructor restore run

    expect(await b.getActiveSession()).not.toBeNull(); // revived
    expect(restoreSpy).toHaveBeenCalled(); // the bridge forwarded to the official restore
    await expect(b.signMessage({ message: 'm' })).resolves.toMatchObject({ signature: 'sig' });
    await b.destroy();
  });

  it('a no-restore official adapter is unchanged: appears connected but the first request throws', async () => {
    const storage = makeStorage();
    const { official: seedAdapter } = makeOfficial({ withRestore: false });
    await seed(storage, seedAdapter);

    const { official: reloadAdapter } = makeOfficial({ withRestore: false });
    const b = createPartyLayer({
      network: 'devnet',
      app: { name: 'discovery-restore', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [reloadAdapter as never],
      storage,
    });
    await new Promise((r) => setTimeout(r, 60));

    expect(await b.getActiveSession()).not.toBeNull(); // revived as-is (looks connected)
    await expect(b.signMessage({ message: 'm' })).rejects.toThrow(/not connected/i); // today's failure shape
    await b.destroy();
  });

  it('the network gate refuses a mismatched-network session BEFORE restore is reached', async () => {
    const storage = makeStorage();
    const { official: seedAdapter } = makeOfficial({ withRestore: true, network: 'devnet' });
    await seed(storage, seedAdapter, 'devnet');

    // Reload on mainnet over the devnet session.
    const { official: reloadAdapter, restoreSpy } = makeOfficial({ withRestore: true, network: 'devnet' });
    const b = createPartyLayer({
      network: 'mainnet',
      app: { name: 'discovery-restore', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [reloadAdapter as never],
      storage,
    });
    await new Promise((r) => setTimeout(r, 60));

    expect(await b.getActiveSession()).toBeNull(); // refused by the gate
    expect(restoreSpy).not.toHaveBeenCalled(); // gate runs before any adapter handoff
    await b.destroy();
  });
});
