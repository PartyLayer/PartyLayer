/**
 * Persist-on-fresh-connect (session 1.0.1).
 *
 * Regression guard for the gap where the store persisted only on RESTORE
 * (init re-reading provider.status) or a party/network SWITCH — never on a
 * fresh connect the store merely OBSERVES via provider events. A session that
 * evaporates if the tab closes before the first reload is not "persistent".
 *
 * The store must persist the moment it first holds BOTH a 'connected' status
 * AND a primary account, regardless of which CIP event arrives first, exactly
 * once per connection, without disturbing the restore/switch persist paths.
 *
 * Runtime: Node (WebCrypto = global crypto.subtle) + fake-indexeddb (key store
 * + ciphertext store).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { CIP0103_EVENTS, type CIP0103Account } from '@partylayer/core';
import type { SessionStorage } from '../storage';
import { createSessionStore } from '../store';
import { createEncryptedIndexedDBStorage } from '../encrypted-storage';
import { createMockWallet } from './local-mock';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function account(partyId: string, primary = true): CIP0103Account {
  return {
    primary,
    partyId,
    status: 'allocated',
    hint: '',
    publicKey: '',
    namespace: '',
    networkId: 'canton:da-devnet',
    signingProviderId: '',
  };
}

/** A SessionStorage that counts setItem (= persist) writes. */
function countingStorage(): { storage: SessionStorage; writes: () => number } {
  const map = new Map<string, string>();
  let writes = 0;
  return {
    storage: {
      getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
      setItem: (k, v) => {
        writes += 1;
        map.set(k, v);
      },
      removeItem: (k) => {
        map.delete(k);
      },
    },
    writes: () => writes,
  };
}

async function waitForDatabases(predicate: (names: string[]) => boolean, timeoutMs = 2000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const names = (await indexedDB.databases()).map((d) => d.name as string);
    if (predicate(names)) return names;
    if (Date.now() > deadline) return names;
    await tick();
  }
}

describe('persist on fresh connect (1.0.1)', () => {
  it('(a) materializes BOTH encrypted DBs on an event-driven connect, pre-reload', async () => {
    const ORIGIN = 'https://hermetic-a.test';
    const provider = createMockWallet();
    const store = createSessionStore(provider, {
      storage: createEncryptedIndexedDBStorage({ origin: ORIGIN }),
      persistSnapshot: true,
    });

    // The store OBSERVES a connect (it never calls its own connect()): the
    // provider emits the standard CIP events a real wallet emits on connect.
    provider.emit(CIP0103_EVENTS.STATUS_CHANGED, {
      connection: { isConnected: true },
      network: { networkId: 'canton:da-devnet' },
    });
    provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account('party::fresh')]);

    const names = await waitForDatabases(
      (n) =>
        n.includes(`partylayer-session-data::${ORIGIN}`) &&
        n.includes(`partylayer-session-key::${ORIGIN}`),
    );
    // Envelope ciphertext store AND the AES CryptoKey store both exist => the
    // encrypted write path ran (key generated + snapshot encrypted) on connect.
    expect(names).toContain(`partylayer-session-data::${ORIGIN}`);
    expect(names).toContain(`partylayer-session-key::${ORIGIN}`);
    store.destroy();
  });

  it('(b) persists for BOTH event arrival orders', async () => {
    // order 1: status -> accounts
    {
      const provider = createMockWallet();
      const { storage, writes } = countingStorage();
      const store = createSessionStore(provider, { storage, persistSnapshot: true });
      provider.emit(CIP0103_EVENTS.STATUS_CHANGED, { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
      provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account('party::order1')]);
      await tick();
      expect(writes()).toBe(1);
      expect(store.getSnapshot().status).toBe('connected');
      store.destroy();
    }
    // order 2: accounts -> status
    {
      const provider = createMockWallet();
      const { storage, writes } = countingStorage();
      const store = createSessionStore(provider, { storage, persistSnapshot: true });
      provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account('party::order2')]);
      await tick();
      expect(writes()).toBe(0); // not connected yet
      provider.emit(CIP0103_EVENTS.STATUS_CHANGED, { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
      await tick();
      expect(writes()).toBe(1);
      store.destroy();
    }
  });

  it('(c) does NOT double-persist on replayed connect events', async () => {
    const provider = createMockWallet();
    const { storage, writes } = countingStorage();
    const store = createSessionStore(provider, { storage, persistSnapshot: true });

    const status = { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } };
    const accts = [account('party::once')];
    provider.emit(CIP0103_EVENTS.STATUS_CHANGED, status);
    provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, accts);
    await tick();
    expect(writes()).toBe(1);

    // Replay identical events (a provider re-emitting on focus/visibility, etc.)
    provider.emit(CIP0103_EVENTS.STATUS_CHANGED, status);
    provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, accts);
    await tick();
    expect(writes()).toBe(1); // guard held — no redundant write
    store.destroy();
  });

  it('(d) restore and party-switch persist paths are unchanged', async () => {
    // restore: provider already connected at init -> persists once (existing).
    {
      const provider = createMockWallet({ connected: true });
      const { storage, writes } = countingStorage();
      const store = createSessionStore(provider, { storage, persistSnapshot: true });
      await store.init();
      expect(store.getSnapshot().status).toBe('connected');
      expect(writes()).toBe(1);
      store.destroy();
    }
    // switch: connect, then a party switch persists again (existing behavior),
    // and the fresh-connect guard does NOT suppress it.
    {
      const provider = createMockWallet();
      const { storage, writes } = countingStorage();
      const store = createSessionStore(provider, { storage, persistSnapshot: true });
      provider.emit(CIP0103_EVENTS.STATUS_CHANGED, { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
      provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account('party::first')]);
      await tick();
      expect(writes()).toBe(1);
      provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account('party::second')]);
      await tick();
      expect(writes()).toBe(2); // switch persisted the new party
      store.destroy();
    }
  });
});
