// @vitest-environment happy-dom
/**
 * usePartyState tests: the party-focused composable, the Vue mirror of React's
 * usePartyState. Built on useAccount, so it must update reactively, agree with
 * useAccount on the shared fields, and expose exactly the party-focused subset of
 * ComputedRefs (no address/chain/isConnecting/isReconnecting). Mirrors the
 * composables test harness (fake provider, in-memory store, @vue/test-utils).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { createSessionStore, type SessionStore } from '@partylayer/session';
import { SESSION_STORE_KEY } from '../provide';
import { useAccount, usePartyState } from '../composables';

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
  let connected = false;
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
      if (method === 'status') return { connection: { isConnected: connected }, network: { networkId: 'canton:da-devnet' } };
      if (method === 'listAccounts') return [acct('party::a')];
      return {};
    }),
    _setConnected(v: boolean) {
      connected = v;
    },
  };
  return p;
}

function makeStore(p: ReturnType<typeof mockProvider>): SessionStore {
  return createSessionStore(p as unknown as CIP0103Provider, {});
}

function mountWith(store: SessionStore | null, setup: () => unknown) {
  const Consumer = defineComponent({ setup });
  return mount(Consumer, {
    global: store ? { provide: { [SESSION_STORE_KEY as symbol]: store } } : {},
  });
}

beforeEach(() => {});
afterEach(() => {});

describe('usePartyState (Vue mirror of React usePartyState)', () => {
  it('returns party-focused ComputedRefs that update reactively', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    let ps!: ReturnType<typeof usePartyState>;
    mountWith(store, () => {
      ps = usePartyState();
      return () => h('div', ps.status.value);
    });

    expect(ps.status.value).toBe('disconnected');
    expect(ps.isDisconnected.value).toBe(true);
    expect(ps.isConnected.value).toBe(false);
    expect(ps.party.value).toBeNull();
    expect(ps.account.value).toBeNull();
    expect(ps.accounts.value).toEqual([]);
    expect(ps.lastError.value).toBeNull();

    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
    p.emit('accountsChanged', [acct('party::a')]);
    await nextTick();

    expect(ps.status.value).toBe('connected');
    expect(ps.isConnected.value).toBe(true);
    expect(ps.isDisconnected.value).toBe(false);
    expect(ps.party.value).toBe('party::a');
    expect(ps.account.value?.partyId).toBe('party::a');
    expect(ps.accounts.value).toHaveLength(1);
    expect(ps.networkId.value).toBe('canton:da-devnet');
  });

  it('reflects accountsChanged reactively (active party switch)', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    let ps!: ReturnType<typeof usePartyState>;
    mountWith(store, () => {
      ps = usePartyState();
      return () => h('div');
    });
    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
    p.emit('accountsChanged', [acct('party::a')]);
    await nextTick();
    expect(ps.party.value).toBe('party::a');

    p.emit('accountsChanged', [acct('party::b'), acct('party::c', false)]);
    await nextTick();
    expect(ps.party.value).toBe('party::b');
    expect(ps.accounts.value).toHaveLength(2);
  });

  it('agrees with useAccount on the shared fields (same underlying store state)', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    let ps!: ReturnType<typeof usePartyState>;
    let a!: ReturnType<typeof useAccount>;
    mountWith(store, () => {
      ps = usePartyState();
      a = useAccount();
      return () => h('div');
    });
    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
    p.emit('accountsChanged', [acct('party::a')]);
    await nextTick();

    expect(ps.party.value).toBe(a.party.value);
    expect(ps.account.value).toBe(a.account.value);
    expect(ps.accounts.value).toBe(a.accounts.value);
    expect(ps.status.value).toBe(a.status.value);
    expect(ps.isConnected.value).toBe(a.isConnected.value);
    expect(ps.isDisconnected.value).toBe(a.isDisconnected.value);
    expect(ps.networkId.value).toBe(a.networkId.value);
    expect(ps.lastError.value).toBe(a.lastError.value);
  });

  it('exposes exactly the party-focused key set (no address/chain/isConnecting/isReconnecting)', () => {
    const p = mockProvider();
    const store = makeStore(p);
    let ps!: ReturnType<typeof usePartyState>;
    mountWith(store, () => {
      ps = usePartyState();
      return () => h('div');
    });
    const keys = Object.keys(ps).sort();
    expect(keys).toEqual(
      ['account', 'accounts', 'isConnected', 'isDisconnected', 'lastError', 'networkId', 'party', 'status'].sort(),
    );
    expect('address' in ps).toBe(false);
    expect('chain' in ps).toBe(false);
    expect('isConnecting' in ps).toBe(false);
    expect('isReconnecting' in ps).toBe(false);
  });

  it('SSR-safe: disconnected snapshot with no provided store', () => {
    let ps!: ReturnType<typeof usePartyState>;
    mountWith(null, () => {
      ps = usePartyState();
      return () => h('div');
    });
    expect(ps.isDisconnected.value).toBe(true);
    expect(ps.party.value).toBeNull();
    expect(ps.accounts.value).toEqual([]);
  });
});
