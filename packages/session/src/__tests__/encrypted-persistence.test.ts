/**
 * M1-S1 — encrypted session persistence (grant Milestone 1, slice 1).
 *
 * Seeds the grant's "≥8 session lifecycle scenarios" acceptance item:
 *   SCENARIO-1: persist → simulated reload → restore happy path (BOTH backends).
 *   SCENARIO-2: reconcile mismatch → structured diff, no crash.
 *   SCENARIO-3: corrupted blob / wrong key / unknown version → null + cleared.
 * Plus crypto invariants: per-write IV uniqueness, key non-extractability, and
 * localStorage backend stores ZERO key material.
 *
 * Runtime: Node (WebCrypto = global crypto.subtle) + fake-indexeddb (key store
 * and the IndexedDB ciphertext store) + a Map-backed localStorage shim.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createEncryptedIndexedDBStorage,
  createEncryptedLocalStorage,
  encodeSessionEnvelope,
  reconcileSession,
  restoreSession,
  type PersistedSessionSnapshot,
} from '../index';
import { loadOrCreateKey } from '../crypto';
import type { SessionAccount } from '../types';

// ── localStorage shim (deterministic, scannable) ────────────────────────────
class MemoryLocalStorage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null;
  }
  entries(): Array<[string, string]> {
    return [...this.store.entries()];
  }
}

const ORIGIN = 'https://test.example';
const KEY = 'partylayer.session';

function account(partyId: string, networkId = 'canton:da-devnet'): SessionAccount {
  return {
    primary: true,
    partyId,
    status: 'allocated' as SessionAccount['status'],
    hint: 'test',
    publicKey: 'pk-' + partyId,
    namespace: 'ns',
    networkId,
    signingProviderId: 'webauthn-prf',
  };
}

function snapshot(partyId = 'party::a'): PersistedSessionSnapshot {
  const a = account(partyId);
  return { account: a, accounts: [a], networkId: a.networkId, connectedAt: 1_000 };
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryLocalStorage();
});
afterEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = undefined;
});

const BACKENDS = [
  { name: 'IndexedDB', make: () => createEncryptedIndexedDBStorage({ origin: ORIGIN }) },
  { name: 'localStorage', make: () => createEncryptedLocalStorage({ origin: ORIGIN }) },
] as const;

describe('SCENARIO-1: persist → simulated reload → restore (both backends)', () => {
  for (const backend of BACKENDS) {
    it(`round-trips an encrypted session across a reload — ${backend.name}`, async () => {
      const snap = snapshot('party::round-trip');

      // persist
      const writer = backend.make();
      await writer.setItem(KEY, encodeSessionEnvelope(snap));

      // simulated reload: a FRESH backend instance, same origin (key reloaded from IndexedDB)
      const reader = backend.make();
      const restored = await restoreSession(reader, KEY);

      expect(restored).not.toBeNull();
      expect(restored!.account?.partyId).toBe('party::round-trip');
      expect(restored!.accounts).toHaveLength(1);
      expect(restored!.networkId).toBe('canton:da-devnet');
      expect(restored!.connectedAt).toBe(1_000);
    });
  }

  it('the raw stored blob is ciphertext, not the plaintext partyId (localStorage)', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    await s.setItem(KEY, encodeSessionEnvelope(snapshot('party::secret-xyz')));
    const ls = globalThis.localStorage as unknown as MemoryLocalStorage;
    const blobs = ls.entries().map(([, v]) => v).join('\n');
    expect(blobs).not.toContain('party::secret-xyz');
    expect(blobs.length).toBeGreaterThan(0);
  });
});

describe('SCENARIO-2: reconcile snapshot vs live status → structured diff', () => {
  it('account mismatch (A vs B) → diff, no throw', () => {
    const r = reconcileSession(snapshot('party::A'), { account: account('party::B'), networkId: 'canton:da-devnet' });
    expect(r.matches).toBe(false);
    expect(r.diffs).toContainEqual({ field: 'account', persisted: 'party::A', live: 'party::B' });
  });

  it('live has no account → diff persisted vs null', () => {
    const r = reconcileSession(snapshot('party::A'), { account: null, networkId: null });
    expect(r.matches).toBe(false);
    expect(r.diffs.find((d) => d.field === 'account')).toEqual({ field: 'account', persisted: 'party::A', live: null });
  });

  it('identical snapshot vs live → matches, no diffs', () => {
    const a = account('party::A');
    const r = reconcileSession({ account: a, accounts: [a], networkId: a.networkId, connectedAt: 5 }, { account: a, networkId: a.networkId });
    expect(r.matches).toBe(true);
    expect(r.diffs).toHaveLength(0);
  });
});

describe('SCENARIO-3: corrupt / wrong-key / unknown-version → null + cleared, never throws', () => {
  it('tampered ciphertext → getItem null + entry cleared (localStorage)', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    await s.setItem(KEY, encodeSessionEnvelope(snapshot()));
    const ls = globalThis.localStorage as unknown as MemoryLocalStorage;
    const [lsKey, blob] = ls.entries()[0];
    const env = JSON.parse(blob);
    env.ct = btoa('tampered-' + atob(env.ct)); // break AES-GCM auth tag
    ls.setItem(lsKey, JSON.stringify(env));

    await expect(s.getItem(KEY)).resolves.toBeNull();
    expect(ls.getItem(lsKey)).toBeNull(); // cleared
  });

  it('unknown crypto-envelope version (f:99) → null + cleared', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    await s.setItem(KEY, encodeSessionEnvelope(snapshot()));
    const ls = globalThis.localStorage as unknown as MemoryLocalStorage;
    const [lsKey, blob] = ls.entries()[0];
    const env = JSON.parse(blob);
    env.f = 99;
    ls.setItem(lsKey, JSON.stringify(env));

    await expect(s.getItem(KEY)).resolves.toBeNull();
    expect(ls.getItem(lsKey)).toBeNull();
  });

  it('wrong key (rotated) → null', async () => {
    const s = createEncryptedIndexedDBStorage({ origin: ORIGIN });
    await s.setItem(KEY, encodeSessionEnvelope(snapshot()));
    // Rotate: wipe the origin key DB so a fresh key is generated on next read.
    await new Promise<void>((res) => {
      const del = indexedDB.deleteDatabase(`partylayer-session-key::${ORIGIN}`);
      del.onsuccess = () => res();
      del.onerror = () => res();
      del.onblocked = () => res();
    });
    await expect(s.getItem(KEY)).resolves.toBeNull();
  });

  it('unknown SESSION schema version → restoreSession null + cleared', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    // A valid encrypted blob whose PLAINTEXT is a future schema version.
    await s.setItem(KEY, JSON.stringify({ version: 99, account: null, accounts: [], networkId: null, connectedAt: 1 }));
    await expect(restoreSession(s, KEY)).resolves.toBeNull();
    await expect(s.getItem(KEY)).resolves.toBeNull(); // cleared by restoreSession
  });

  it('expired snapshot → restoreSession null + cleared', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    const expired: PersistedSessionSnapshot = { ...snapshot(), expiresAt: 500 };
    await s.setItem(KEY, encodeSessionEnvelope(expired));
    await expect(restoreSession(s, KEY, 1_000)).resolves.toBeNull();
  });
});

describe('crypto invariants', () => {
  it('per-write IV is unique across N writes', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    const N = 25;
    for (let i = 0; i < N; i++) await s.setItem(`k${i}`, encodeSessionEnvelope(snapshot(`p${i}`)));
    const ls = globalThis.localStorage as unknown as MemoryLocalStorage;
    const ivs = ls.entries().map(([, v]) => JSON.parse(v).iv as string);
    expect(ivs).toHaveLength(N);
    expect(new Set(ivs).size).toBe(N); // all distinct
  });

  it('the AES-GCM key is NON-EXTRACTABLE (exportKey rejects)', async () => {
    const key = await loadOrCreateKey(ORIGIN);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toBeDefined();
  });

  it('localStorage backend stores ZERO key material — only {f,iv,ct} envelopes', async () => {
    const s = createEncryptedLocalStorage({ origin: ORIGIN });
    await s.setItem(KEY, encodeSessionEnvelope(snapshot()));
    const ls = globalThis.localStorage as unknown as MemoryLocalStorage;
    for (const [, v] of ls.entries()) {
      const parsed = JSON.parse(v);
      // Only the crypto envelope — never a key handle or raw key field.
      expect(Object.keys(parsed).sort()).toEqual(['ct', 'f', 'iv']);
      expect('key' in parsed).toBe(false);
    }
    // The key itself is a live non-extractable CryptoKey managed via IndexedDB.
    expect((await loadOrCreateKey(ORIGIN)).type).toBe('secret');
  });
});
