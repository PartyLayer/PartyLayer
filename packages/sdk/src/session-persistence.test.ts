/**
 * SDK session persistence round-trip tests.
 *
 * These tests directly exercise the PartyLayerClient persist↔restore contract
 * that Viraj's bug report exposed:
 *
 *   - Before the fix, persistSession() wrote to storage key `session_<sessionId>`
 *     while restoreSession() read from `active_session`. After a page reload
 *     (simulated here by instantiating a fresh client over the same storage)
 *     useSession() would always return null because the keys never matched.
 *
 *   - Regression: every change to session persistence must still satisfy
 *     the round-trip property: a session persisted by client A must be
 *     restorable by a new client B created over the same storage.
 */

import { describe, it, expect, vi } from 'vitest';
import type { WalletAdapter, Session, PersistedSession, Storage } from '@partylayer/core';
import {
  toWalletId,
  toPartyId,
} from '@partylayer/core';

// Console adapter's SDK imports SVG files which explode under Node. Stub it
// so we can load createPartyLayer in a headless test environment.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

// Registry fetches over the network — stub it so tests run offline.
vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>(
    '@partylayer/registry-client',
  );
  const core = await vi.importActual<typeof import('@partylayer/core')>('@partylayer/core');
  class OfflineRegistryClient {
    constructor() {}
    async getWallets() { return []; }
    async listWallets() { return []; }
    async getWalletEntry(id: string) {
      // Match real RegistryClient contract: throw WalletNotFoundError when
      // the wallet isn't in the registry.
      throw new core.WalletNotFoundError(id);
    }
    async getRegistry() { return { wallets: [], metadata: {} }; }
    async refreshRegistry() { return { wallets: [], metadata: {} }; }
    getStatus() { return { state: 'offline', lastFetchAt: null, lastError: null }; }
    onStatusChange() { return () => {}; }
  }
  return {
    ...actual,
    RegistryClient: OfflineRegistryClient,
  };
});

import { createPartyLayer } from './index';

/** In-memory Storage implementation that records every key ever touched. */
function makeRecordingStorage() {
  const data = new Map<string, string>();
  const keysTouched: string[] = [];
  const storage: Storage = {
    async get(key: string) {
      keysTouched.push(`get:${key}`);
      return data.get(key) ?? null;
    },
    async set(key: string, value: string) {
      keysTouched.push(`set:${key}`);
      data.set(key, value);
    },
    async remove(key: string) {
      keysTouched.push(`remove:${key}`);
      data.delete(key);
    },
    async clear() {
      keysTouched.push('clear');
      data.clear();
    },
  };
  return { storage, data, keysTouched };
}

/**
 * A restorable mock adapter. Connect seeds the session metadata with a
 * token; restore returns the same session back when the token is present
 * and not expired — mirroring what Console/Loop/Nightly do in production.
 */
class RestorableMockAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock-restorable');
  readonly name = 'Mock Restorable Adapter';

  getCapabilities() {
    return ['connect', 'disconnect', 'restore', 'events'] as ReturnType<WalletAdapter['getCapabilities']>;
  }

  async detectInstalled() {
    return { installed: true };
  }

  async connect() {
    return {
      partyId: toPartyId('party::restorable'),
      session: {
        walletId: this.walletId,
        network: 'devnet' as const,
        createdAt: Date.now(),
        metadata: { sessionToken: 'tok-valid' },
      },
      capabilities: ['connect'] as ReturnType<WalletAdapter['getCapabilities']>,
    };
  }

  async disconnect() {}

  async restore(_ctx: unknown, persisted: PersistedSession): Promise<Session | null> {
    if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;
    if (persisted.metadata?.sessionToken !== 'tok-valid') return null;
    return { ...persisted, walletId: this.walletId };
  }
}

describe('SDK session persistence — round-trip', () => {
  it('persistSession and restoreSession use the same storage key', async () => {
    const { storage, keysTouched } = makeRecordingStorage();

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'session-persistence-test', origin: 'https://test.example' },
      // No registry — we pass the adapter directly
      registryUrl: 'https://unused.invalid',
      adapters: [new RestorableMockAdapter()],
      storage,
    });

    await client.connect({ walletId: toWalletId('mock-restorable') });

    // Extract the key used for set() during persist.
    const setEvents = keysTouched.filter((e) => e.startsWith('set:'));
    expect(setEvents.length).toBeGreaterThan(0);
    // The session-persistence set call should use a stable, non-sessionId key.
    const setKey = setEvents[0].slice('set:'.length);

    await client.destroy();

    // Fresh client over the same storage — simulates a page reload.
    const { storage: _unusedRecorder, keysTouched: getsDuringRestore } =
      (() => {
        const { storage: _wrapped, keysTouched: _unused } = makeRecordingStorage();
        return { storage: _wrapped, keysTouched: _unused };
      })();

    // Actually build a fresh client sharing the ORIGINAL data-backed storage.
    const client2 = createPartyLayer({
      network: 'devnet',
      app: { name: 'session-persistence-test', origin: 'https://test.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new RestorableMockAdapter()],
      storage,
    });

    // Give restoreSession (fired from the constructor) time to complete.
    await new Promise((r) => setTimeout(r, 50));

    // The restore code must have read the SAME key that persist wrote to.
    const getEvents = keysTouched.filter((e) => e.startsWith('get:'));
    const readKeys = getEvents.map((e) => e.slice('get:'.length));
    expect(readKeys).toContain(setKey);

    // And most importantly — the active session should be non-null after restore.
    const restored = await client2.getActiveSession();
    expect(restored).not.toBeNull();
    expect(restored?.walletId).toBe(toWalletId('mock-restorable'));

    await client2.destroy();
    // Silence linter about unused destructured binding.
    void _unusedRecorder;
    void getsDuringRestore;
  });

  it('persistSession writes to a key that restoreSession can read back', async () => {
    const { storage, data } = makeRecordingStorage();

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'session-roundtrip', origin: 'https://roundtrip.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new RestorableMockAdapter()],
      storage,
    });

    await client.connect({ walletId: toWalletId('mock-restorable') });
    expect(data.size).toBeGreaterThan(0);

    // Snapshot the storage contents before destroying the client.
    const snapshotKeys = [...data.keys()];
    await client.destroy();

    // New client instance — same storage. This is the page-reload case.
    const client2 = createPartyLayer({
      network: 'devnet',
      app: { name: 'session-roundtrip', origin: 'https://roundtrip.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new RestorableMockAdapter()],
      storage,
    });

    await new Promise((r) => setTimeout(r, 50));

    const session = await client2.getActiveSession();
    expect(session, `expected a restored session; storage had keys: ${snapshotKeys.join(', ')}`).not.toBeNull();
    expect(session?.partyId).toBe(toPartyId('party::restorable'));

    await client2.destroy();
  });

  it('restoreSession returns null when storage is empty', async () => {
    const { storage } = makeRecordingStorage();

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'empty-storage', origin: 'https://empty.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new RestorableMockAdapter()],
      storage,
    });

    await new Promise((r) => setTimeout(r, 50));
    const session = await client.getActiveSession();
    expect(session).toBeNull();

    await client.destroy();
  });

  it('disconnect clears the same key persist wrote to', async () => {
    const { storage, data } = makeRecordingStorage();

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'disconnect-clears', origin: 'https://disc.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new RestorableMockAdapter()],
      storage,
    });

    await client.connect({ walletId: toWalletId('mock-restorable') });
    expect(data.size).toBeGreaterThan(0);

    await client.disconnect();
    expect(data.size).toBe(0);

    await client.destroy();
    vi.clearAllMocks();
  });
});
