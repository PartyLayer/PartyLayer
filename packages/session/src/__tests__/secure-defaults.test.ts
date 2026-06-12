/**
 * 1.0 secure-by-default persistence: with NO options, the store persists the
 * full session snapshot to ENCRYPTED IndexedDB where the platform supports it,
 * and falls back to in-memory (no throw) where it does not.
 *
 * Runtime: Node + WebCrypto (global crypto.subtle) + fake-indexeddb for the
 * capability-present cases; capability is toggled off per-test for the fallbacks.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockWallet } from './local-mock';
import type { CIP0103Provider } from '@partylayer/core';
import { createSessionStore } from '../store';
import { createMemoryStorage } from '../storage';
import { createEncryptedIndexedDBStorage } from '../encrypted-storage';
import { decodeSessionEnvelope } from '../session-envelope';

const KEY = 'partylayer.session.connected';
const mk = (opts?: Parameters<typeof createMockWallet>[0]) =>
  createMockWallet(opts) as unknown as CIP0103Provider;

afterEach(() => {
  // Restore indexedDB if a test removed it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).indexedDB) (globalThis as any).indexedDB = (globalThis as any).__realIDB;
});

describe('1.0 secure-by-default: capability present (indexedDB + crypto.subtle)', () => {
  it('omitted options ⇒ persists a SNAPSHOT to encrypted IndexedDB (read back via the encrypted backend)', async () => {
    const provider = mk({ connected: true });
    const store = createSessionStore(provider, {}); // NO options → encrypted IDB default
    await store.connect();
    expect(store.getSnapshot().status).toBe('connected');

    // A SEPARATE encrypted-IDB backend reads back what the default store wrote —
    // proving the default landed in the shared origin-bound encrypted IndexedDB
    // (in-memory storage is per-instance and could NOT be read this way), AND
    // that persistSnapshot defaulted to true (a decodable envelope, not '1').
    const raw = await createEncryptedIndexedDBStorage().getItem(KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toBe('1'); // not the legacy marker
    expect(decodeSessionEnvelope(raw as string)).not.toBeNull(); // a real, decrypted envelope
    store.destroy();
  });
});

describe('1.0 secure-by-default: capability absent ⇒ in-memory fallback (no throw)', () => {
  it('no indexedDB (Node/SSR): omitted options still connect, no throw', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    g.__realIDB = g.indexedDB;
    delete g.indexedDB;
    try {
      const provider = mk({ connected: true });
      const store = createSessionStore(provider, {}); // omitted → memory fallback
      await expect(store.connect()).resolves.toBeTruthy();
      expect(store.getSnapshot().status).toBe('connected');
      store.destroy();
    } finally {
      g.indexedDB = g.__realIDB;
    }
  });

  it('window present but no indexedDB (jsdom/happy-dom-like): in-memory fallback', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    g.__realIDB = g.indexedDB;
    delete g.indexedDB;
    g.window = g.window ?? {};
    try {
      const provider = mk({ connected: true });
      const store = createSessionStore(provider, {});
      await expect(store.connect()).resolves.toBeTruthy();
      expect(store.getSnapshot().status).toBe('connected');
      store.destroy();
    } finally {
      g.indexedDB = g.__realIDB;
      if (g.window && Object.keys(g.window).length === 0) delete g.window;
    }
  });
});

describe('1.0 secure-by-default: explicit opt-outs respected', () => {
  it('storage: createMemoryStorage() ⇒ honored (the supplied storage receives the write)', async () => {
    const provider = mk({ connected: true });
    const storage = createMemoryStorage();
    const store = createSessionStore(provider, { storage });
    await store.connect();
    // The explicit memory storage was used (it got the write), not the default IDB.
    expect(await storage.getItem(KEY)).not.toBeNull();
    store.destroy();
  });

  it('persistSnapshot: false ⇒ writes the bare marker, not a snapshot', async () => {
    const provider = mk({ connected: true });
    const storage = createMemoryStorage();
    const store = createSessionStore(provider, { storage, persistSnapshot: false });
    await store.connect();
    expect(await storage.getItem(KEY)).toBe('1'); // legacy marker, opted out
    store.destroy();
  });
});
