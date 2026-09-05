/**
 * `session:expired` is emitted from four places in client.ts. Three read a local
 * variable captured before the session is cleared; one reads `this.activeSession`
 * after `await this.disconnect()`, which nulls it on success.
 *
 * These tests exercise each site rather than pattern-matching the four by eye. A
 * site that looks similar but is guarded should be left alone, and one that looks
 * different but is unguarded still needs fixing, so the only way to tell is to
 * make each one fire.
 *
 * Every assertion here is on an OUTCOME: what was emitted, what was returned,
 * whether it threw. None of them assert that a function was called.
 *
 * COVERAGE, stated plainly so nobody assumes more than is here.
 *
 *   getActiveSession expiry      DRIVEN. Reproduced the TypeError before the
 *                                fix and passes after.
 *   restoreSession, restore null DRIVEN.
 *   restoreSession, mismatch     DRIVEN. Verified by mutation: deleting that
 *                                emit fails this test and only this test.
 *   listWallets re-probe         DRIVEN, in session-expired-reprobe.test.ts.
 *                                It needs its own file because reaching it
 *                                requires a stubbed `window` and a mocked
 *                                announce discovery. Guarded, and the guard is
 *                                itself tested by mutation.
 */

import { describe, it, expect, vi } from 'vitest';
import type { WalletAdapter, Session, PersistedSession, Storage } from '@partylayer/core';
import { toWalletId, toPartyId } from '@partylayer/core';

// Same two stubs session-persistence.test.ts uses. The console adapter's SDK
// imports SVGs, which explode under Node, and the registry client fetches over
// the network. Without these the client throws TransportError inside connect()
// and never reaches the code under test.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

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

/** Minimal in-memory Storage, kept local so this file stands alone. */
function makeStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(seed));
  return {
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async set(key: string, value: string) {
      data.set(key, value);
    },
    async remove(key: string) {
      data.delete(key);
    },
    async clear() {
      data.clear();
    },
  } as Storage;
}

interface AdapterOptions {
  /** Milliseconds from now; negative means already expired. */
  expiresInMs?: number;
  /** What restore() returns, so the restore-failure path can be driven. */
  restoreResult?: 'valid' | 'null';
  /** Network the connect() session claims, for the mismatch path. */
  network?: string;
}

class MockAdapter implements WalletAdapter {
  readonly walletId = toWalletId('mock-restorable');
  readonly name = 'Mock Adapter';
  constructor(private readonly opts: AdapterOptions = {}) {}

  getCapabilities() {
    return ['connect', 'disconnect', 'restore', 'events'] as ReturnType<
      WalletAdapter['getCapabilities']
    >;
  }

  async detectInstalled() {
    return { installed: true };
  }

  async connect() {
    const { expiresInMs, network } = this.opts;
    return {
      partyId: toPartyId('party::restorable'),
      session: {
        walletId: this.walletId,
        network: (network ?? 'devnet') as 'devnet',
        createdAt: Date.now(),
        ...(expiresInMs === undefined ? {} : { expiresAt: Date.now() + expiresInMs }),
        metadata: { sessionToken: 'tok-valid' },
      },
      capabilities: ['connect'] as ReturnType<WalletAdapter['getCapabilities']>,
    };
  }

  async disconnect() {}

  async restore(_ctx: unknown, persisted: PersistedSession): Promise<Session | null> {
    if (this.opts.restoreResult === 'null') return null;
    if (persisted.expiresAt && Date.now() >= persisted.expiresAt) return null;
    return { ...persisted, walletId: this.walletId };
  }
}

function makeClient(adapter: WalletAdapter, storage: Storage) {
  return createPartyLayer({
    network: 'devnet',
    app: { name: 'expired-emit', origin: 'https://expired.example' },
    registryUrl: 'https://unused.invalid',
    adapters: [adapter],
    storage,
  });
}

describe('session:expired emit sites', () => {
  it('getActiveSession: emits with the real session id and does not throw', async () => {
    // client.ts getActiveSession(): `await this.disconnect()` nulls
    // this.activeSession, and the emit that follows reads it.
    const client = makeClient(new MockAdapter({ expiresInMs: -1 }), makeStorage());
    await client.connect({ walletId: toWalletId('mock-restorable') });

    const seen: Array<{ sessionId: unknown }> = [];
    client.on('session:expired', (e) => seen.push(e as { sessionId: unknown }));

    await expect(client.getActiveSession()).resolves.toBeNull();
    expect(seen).toHaveLength(1);
    // The id must be the expired session's, not undefined and not a placeholder.
    expect(typeof seen[0]?.sessionId).toBe('string');
    expect(seen[0]?.sessionId).toBeTruthy();

    await client.destroy();
  });

  it('restoreSession, restore returns null: emits with the stored session id', async () => {
    // client.ts restoreSession(): removeSession(session.sessionId) then emit,
    // reading the LOCAL `session`. Unaffected by the disconnect() nulling.
    //
    // Asserts on the VALUE, not the count, deliberately. The constructor kicks
    // off restoreSession() fire-and-forget (client.ts:283) and getActiveSession
    // calls it again, so a test that pins the count is measuring that race
    // rather than this emit site. Every event must still carry a real id.
    const storage = makeStorage();
    const seed = makeClient(new MockAdapter(), storage);
    await seed.connect({ walletId: toWalletId('mock-restorable') });
    await seed.destroy();

    const client = makeClient(new MockAdapter({ restoreResult: 'null' }), storage);
    const seen: Array<{ sessionId: unknown }> = [];
    client.on('session:expired', (e) => seen.push(e as { sessionId: unknown }));

    await expect(client.getActiveSession()).resolves.toBeNull();
    expect(seen.length).toBeGreaterThanOrEqual(1);
    for (const e of seen) {
      expect(typeof e.sessionId).toBe('string');
      expect(e.sessionId).toBeTruthy();
    }

    await client.destroy();
  });

  it('restoreSession, network mismatch under enforcement: emits with the stored session id', async () => {
    // client.ts restoreSession(): the mismatch branch also reads the LOCAL
    // `session`, and reaches the emit through a different route than the
    // restore-null branch above, so it is driven separately rather than
    // assumed equivalent.
    const storage = makeStorage();
    const seed = createPartyLayer({
      network: 'mainnet',
      app: { name: 'expired-emit', origin: 'https://expired.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new MockAdapter({ network: 'mainnet' })],
      storage,
    });
    await seed.connect({ walletId: toWalletId('mock-restorable') });
    await seed.destroy();

    // Same stored session, client now configured for a different network.
    const client = makeClient(new MockAdapter(), storage);
    const seen: Array<{ sessionId: unknown }> = [];
    client.on('session:expired', (e) => seen.push(e as { sessionId: unknown }));

    await expect(client.getActiveSession()).resolves.toBeNull();
    expect(seen.length).toBeGreaterThanOrEqual(1);
    for (const e of seen) {
      expect(typeof e.sessionId).toBe('string');
      expect(e.sessionId).toBeTruthy();
    }

    await client.destroy();
  });
});
