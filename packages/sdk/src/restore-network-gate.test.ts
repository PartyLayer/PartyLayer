/**
 * B5 — restore network-gate (the mainnet-eyeball finding, generalized).
 *
 * A persisted session carries its network (our network-aware envelope). On
 * restore, the SDK validates it against the configured network BEFORE any
 * adapter handoff. This closes the silent stale-network restore: a
 * discovery-adapter session has no `adapter.restore`, so it would otherwise take
 * the "restore as-is" path and revive (e.g.) a devnet identity on a mainnet app
 * — the official adapter's restore is silent, so the connect-time mismatch check
 * never fires. Under enforcement we REFUSE + clear; under 'off' we restore but
 * flag. Generic for ANY wallet whose adapter lacks `restore` (the as-is path).
 */
import { describe, it, expect, vi } from 'vitest';
import type { WalletAdapter, Storage } from '@partylayer/core';
import { toWalletId, toPartyId } from '@partylayer/core';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

// Offline registry — restore is fully local (storage + crypto), no network.
vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>(
    '@partylayer/registry-client',
  );
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

function makeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    async get(k) { return data.get(k) ?? null; },
    async set(k, v) { data.set(k, v); },
    async remove(k) { data.delete(k); },
    async clear() { data.clear(); },
  };
}

/**
 * Mock WITHOUT `restore` — the as-is restore path (mirrors
 * GenericDiscoveryAdapter, which has no adapter.restore). Connects on `network`.
 */
class NoRestoreMockAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock-norestore');
  readonly name = 'No-Restore Mock';
  // `net` is the network the adapter records on the session — including
  // unrecognized values like 'canton:unknown' (the real popup/remote shape).
  constructor(private readonly net: string) {}
  getCapabilities() {
    return ['connect', 'disconnect'] as ReturnType<WalletAdapter['getCapabilities']>;
  }
  async detectInstalled() { return { installed: true }; }
  async connect() {
    return {
      partyId: toPartyId('party::norestore'),
      session: { walletId: this.walletId, network: this.net, createdAt: Date.now() },
      capabilities: ['connect'] as ReturnType<WalletAdapter['getCapabilities']>,
    };
  }
  async disconnect() {}
  // intentionally NO restore() — exercises the "restore as-is" path
}

const ORIGIN = 'https://test.example.com';
const WID = toWalletId('mock-norestore');

/**
 * Persist a session of `network` into `storage` via a first client (config
 * defaults to the same network so the connect itself doesn't mismatch), then
 * destroy it. Pass an unrecognized `network` (e.g. 'canton:unknown') to seed the
 * real popup/remote shape.
 */
async function seedSession(storage: Storage, network: string, config: string = network) {
  const a = createPartyLayer({
    network: config as never,
    app: { name: 'restore-gate', origin: ORIGIN },
    registryUrl: 'https://unused.invalid',
    adapters: [new NoRestoreMockAdapter(network)],
    storage,
  });
  await a.connect({ walletId: WID });
  await a.destroy();
}

/** Persist a `devnet` session (back-compat helper for the existing cases). */
async function seedDevnetSession(storage: Storage) {
  await seedSession(storage, 'devnet');
}

describe('restore network-gate (B5)', () => {
  it('REFUSES a devnet session on a mainnet app (default guard) — cleared, not restored', async () => {
    const storage = makeStorage();
    await seedDevnetSession(storage);

    // Fresh client on mainnet over the SAME storage (simulated reload).
    const b = createPartyLayer({
      network: 'mainnet',
      app: { name: 'restore-gate', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [new NoRestoreMockAdapter('mainnet')],
      storage,
    });
    await new Promise((r) => setTimeout(r, 50)); // let constructor restore run

    expect(await b.getActiveSession()).toBeNull(); // devnet identity NOT revived
    // And it was cleared, so a same-network client afterwards finds nothing.
    const c = createPartyLayer({
      network: 'devnet',
      app: { name: 'restore-gate', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [new NoRestoreMockAdapter('devnet')],
      storage,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(await c.getActiveSession()).toBeNull(); // cleared by the refusal
    await b.destroy();
    await c.destroy();
  });

  it('CONTROL: same-network (devnet) restore still succeeds', async () => {
    const storage = makeStorage();
    await seedDevnetSession(storage);

    const b = createPartyLayer({
      network: 'devnet',
      app: { name: 'restore-gate', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [new NoRestoreMockAdapter('devnet')],
      storage,
    });
    await new Promise((r) => setTimeout(r, 50));

    const restored = await b.getActiveSession();
    expect(restored).not.toBeNull();
    expect(restored?.walletId).toBe(WID);
    expect(restored?.networkMismatch).toBeUndefined();
    await b.destroy();
  });

  it("'off': restores the cross-network session but FLAGS networkMismatch", async () => {
    const storage = makeStorage();
    await seedDevnetSession(storage);

    const b = createPartyLayer({
      network: 'mainnet',
      networkEnforcement: 'off',
      app: { name: 'restore-gate', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [new NoRestoreMockAdapter('mainnet')],
      storage,
    });
    await new Promise((r) => setTimeout(r, 50));

    const restored = await b.getActiveSession();
    expect(restored).not.toBeNull(); // 'off' never blocks
    // Flagged with the CAIP2-normalized mismatch (same shape as connect-time).
    expect(restored?.networkMismatch).toEqual({
      expected: 'canton:da-mainnet',
      actual: 'canton:da-devnet',
    });
    await b.destroy();
  });

  // ── The REAL shape (the consumer-E2E finding): a persisted session whose
  //    network is the unrecognized 'canton:unknown' (as popup/remote wallets
  //    reported pre-bridge-fix) must STILL be refused on a different network —
  //    the prior core fail-open let it through. ────────────────────────────────
  it("REFUSES a 'canton:unknown' session on a mainnet app (the fail-open fix)", async () => {
    const storage = makeStorage();
    await seedSession(storage, 'canton:unknown'); // config also canton:unknown → clean seed

    const b = createPartyLayer({
      network: 'mainnet',
      app: { name: 'restore-gate', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [new NoRestoreMockAdapter('mainnet')],
      storage,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(await b.getActiveSession()).toBeNull(); // NOT silently restored
    await b.destroy();
  });

  it("CONTROL: an equal-network 'canton:unknown' restore still succeeds (false-positive guard)", async () => {
    const storage = makeStorage();
    await seedSession(storage, 'canton:unknown');

    const b = createPartyLayer({
      network: 'canton:unknown' as never, // same (unrecognized) network → must NOT refuse
      app: { name: 'restore-gate', origin: ORIGIN },
      registryUrl: 'https://unused.invalid',
      adapters: [new NoRestoreMockAdapter('canton:unknown')],
      storage,
    });
    await new Promise((r) => setTimeout(r, 50));
    const restored = await b.getActiveSession();
    expect(restored).not.toBeNull(); // equal network → restored
    expect(restored?.networkMismatch).toBeUndefined();
    await b.destroy();
  });
});
