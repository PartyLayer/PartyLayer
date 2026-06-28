// @vitest-environment happy-dom
/**
 * Optional Pinia integration tests. The Pinia store wraps the SAME @partylayer/session
 * SessionStore the composables wrap, so it must mirror the session state reactively
 * (provider events update it), delegate its actions to the session store, and expose
 * the same field surface as usePartyState. Uses createPinia()/setActivePinia so the
 * setup store can be exercised directly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { createSessionStore, type SessionStore } from '@partylayer/session';
import { definePartyLayerStore } from '../pinia';

const acct = (partyId: string, primary = true): CIP0103Account => ({
  primary,
  partyId,
  status: 'allocated' as CIP0103Account['status'],
  hint: 'h',
  publicKey: 'pk',
  namespace: 'ns',
  networkId: 'canton:da-devnet',
  signingProviderId: 'webauthn-prf',
});

function mockProvider() {
  const ls = new Map<string, Set<(...a: unknown[]) => void>>();
  const p = {
    on(e: string, l: (...a: unknown[]) => void) {
      (ls.get(e) ?? ls.set(e, new Set()).get(e)!).add(l);
      return p;
    },
    removeListener: vi.fn((e: string, l: (...a: unknown[]) => void) => {
      ls.get(e)?.delete(l);
      return p;
    }),
    emit(e: string, ...args: unknown[]) {
      ls.get(e)?.forEach((l) => l(...args));
    },
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'status') return { connection: { isConnected: false } };
      if (method === 'listAccounts') return [acct('party::a')];
      return {};
    }),
  };
  return p;
}

function makeStore(p: ReturnType<typeof mockProvider>): SessionStore {
  return createSessionStore(p as unknown as CIP0103Provider, {});
}

let pinia = createPinia();
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('definePartyLayerStore (optional Pinia integration)', () => {
  it('mirrors the session state reactively (provider events update the store)', () => {
    const provider = mockProvider();
    const store = makeStore(provider);
    const pl = definePartyLayerStore(store)();

    expect(pl.isDisconnected).toBe(true);
    expect(pl.isConnected).toBe(false);
    expect(pl.party).toBeNull();
    expect(pl.account).toBeNull();

    provider.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
    provider.emit('accountsChanged', [acct('party::a')]);

    expect(pl.isConnected).toBe(true);
    expect(pl.isDisconnected).toBe(false);
    expect(pl.party).toBe('party::a');
    expect(pl.account?.partyId).toBe('party::a');
    expect(pl.networkId).toBe('canton:da-devnet');
    expect(pl.accounts).toHaveLength(1);
  });

  it('actions delegate to the wrapped session store', async () => {
    const store = makeStore(mockProvider());
    const connectSpy = vi.spyOn(store, 'connect').mockResolvedValue(store.getSnapshot());
    const disconnectSpy = vi.spyOn(store, 'disconnect').mockResolvedValue();
    const restoreSpy = vi.spyOn(store, 'restore').mockResolvedValue(store.getSnapshot());

    const pl = definePartyLayerStore(store)();
    await pl.connect({ foo: 1 });
    await pl.disconnect();
    await pl.restore();

    expect(connectSpy).toHaveBeenCalledWith({ foo: 1 });
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledTimes(1);
  });

  it('exposes the same field surface as usePartyState (plus actions)', () => {
    const pl = definePartyLayerStore(makeStore(mockProvider()))();
    for (const field of ['party', 'account', 'accounts', 'status', 'isConnected', 'isDisconnected', 'networkId', 'lastError']) {
      expect(field in pl).toBe(true);
    }
    expect(typeof pl.connect).toBe('function');
    expect(typeof pl.disconnect).toBe('function');
    expect(typeof pl.restore).toBe('function');
  });

  it('wraps the same store: two store ids over one session store stay in sync', () => {
    const provider = mockProvider();
    const store = makeStore(provider);
    const pl = definePartyLayerStore(store, 'pl-test')();

    provider.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-mainnet' } });
    provider.emit('accountsChanged', [acct('party::z')]);

    // Reflects the SAME underlying session store the composables would read.
    expect(pl.party).toBe('party::z');
    expect(store.getSnapshot().account?.partyId).toBe('party::z');
  });
});
