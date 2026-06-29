// @vitest-environment happy-dom
/**
 * Hermetic Vue composable tests: fake CIP-0103 provider, in-memory session
 * store, @vue/test-utils. Zero real I/O.
 *
 * Covers: reactivity (useSession/useAccount), useAccountEffect callbacks
 * (connect/disconnect/party-switch), SSR/no-store safety, the MANDATORY
 * scope-dispose-no-leak invariant, and the provide-layer ownership rule.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, type App } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { createSessionStore, type SessionStore } from '@partylayer/session';
import { SESSION_STORE_KEY, createPartyLayerSession, provideSessionStore } from '../provide';
import { useAccount, useAccountEffect, useSession } from '../composables';

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

/** Mount a consumer with a store provided via the injection key. */
function mountWith(store: SessionStore | null, setup: () => unknown) {
  const Consumer = defineComponent({ setup });
  return mount(Consumer, {
    global: store ? { provide: { [SESSION_STORE_KEY as symbol]: store } } : {},
  });
}

let providers: ReturnType<typeof mockProvider>[] = [];
beforeEach(() => {
  providers = [];
});
afterEach(() => {
  providers = [];
});

describe('useSession / useAccount reactivity', () => {
  it('refs update when the provider drives the store', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    let s!: ReturnType<typeof useSession>;
    let a!: ReturnType<typeof useAccount>;
    mountWith(store, () => {
      s = useSession();
      a = useAccount();
      return () => h('div', s.status.value);
    });

    expect(s.status.value).toBe('disconnected');
    expect(a.isConnected.value).toBe(false);

    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
    p.emit('accountsChanged', [acct('party::a')]);
    await nextTick();

    expect(s.status.value).toBe('connected');
    expect(s.isConnected.value).toBe(true);
    expect(s.account.value?.partyId).toBe('party::a');
    expect(s.networkId.value).toBe('canton:da-devnet');
    expect(a.party.value).toBe('party::a');
    expect(a.address.value).toBe('party::a');
    expect(a.chain.value).toEqual({ id: 'canton:da-devnet' });
  });
});

describe('useAccountEffect', () => {
  it('fires onConnect / onDisconnect / onPartyChanged', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onPartyChanged = vi.fn();
    mountWith(store, () => {
      useAccountEffect({ onConnect, onDisconnect, onPartyChanged });
      return () => h('div');
    });

    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
    p.emit('accountsChanged', [acct('party::a')]);
    await nextTick();
    expect(onConnect).toHaveBeenCalledTimes(1);

    p.emit('accountsChanged', [acct('party::b')]); // switch a → b
    await nextTick();
    expect(onPartyChanged).toHaveBeenCalledWith({ previous: 'party::a', current: 'party::b' });

    p.emit('statusChanged', { connection: { isConnected: false } });
    await nextTick();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });
});

describe('SSR / no-store safety', () => {
  it('with no provided store: disconnected refs + no-throw no-op actions', async () => {
    let s!: ReturnType<typeof useSession>;
    mountWith(null, () => {
      s = useSession();
      return () => h('div');
    });
    expect(s.status.value).toBe('disconnected');
    expect(s.isDisconnected.value).toBe(true);
    await expect(s.connect()).resolves.toBeTruthy();
    await expect(s.disconnect()).resolves.toBeUndefined();
    expect(typeof s.on('party:changed', () => {})).toBe('function');
    // useAccountEffect must also no-op without throwing.
    expect(() =>
      mountWith(null, () => {
        useAccountEffect({ onConnect: () => {} });
        return () => h('div');
      }),
    ).not.toThrow();
  });
});

describe('scope-dispose: no leak after unmount (MANDATORY)', () => {
  it('unsubscribes from the store when the component scope tears down', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    // Count active store subscribers via a thin wrapper around subscribe.
    let active = 0;
    const realSubscribe = store.subscribe.bind(store);
    store.subscribe = (listener: () => void) => {
      active += 1;
      const unsub = realSubscribe(listener);
      return () => {
        active -= 1;
        unsub();
      };
    };

    const wrapper = mountWith(store, () => {
      useSession();
      useAccount();
      return () => h('div');
    });
    expect(active).toBeGreaterThan(0); // composables subscribed

    wrapper.unmount();
    await nextTick();
    expect(active).toBe(0); // every subscription cleaned up, no leak
  });
});

describe('provide ownership rule', () => {
  it('config-built store: init() on mount, destroy() (provider listeners removed) on unmount', async () => {
    const p = mockProvider();
    const wrapper = mountWith(null, () => {
      provideSessionStore({ provider: p as unknown as CIP0103Provider });
      return () => h('div');
    });
    await flushPromises(); // onMounted → store.init() (probes provider.status())
    expect(p.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'status' }));

    wrapper.unmount();
    await nextTick();
    expect(p.removeListener).toHaveBeenCalled(); // store.destroy() removed provider listeners
  });

  it('pre-built store: lifecycle belongs to the caller, never destroyed', async () => {
    const p = mockProvider();
    const store = makeStore(p);
    const destroySpy = vi.spyOn(store, 'destroy');
    const wrapper = mountWith(null, () => {
      provideSessionStore(store);
      return () => h('div');
    });
    await flushPromises();
    wrapper.unmount();
    await nextTick();
    expect(destroySpy).not.toHaveBeenCalled();
  });
});

describe('plugin install: SSR-safe init guard', () => {
  // The plugin's install() runs during SSR too (Nuxt installs server-side), so
  // init() must be guarded by `typeof window !== 'undefined'`.
  const fakeApp = () => ({ provide: vi.fn(), unmount: vi.fn() }) as unknown as App;

  it('does NOT init() when installed without window (SSR)', async () => {
    const p = mockProvider();
    const orig = Object.getOwnPropertyDescriptor(globalThis, 'window');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window; // simulate a server runtime
    try {
      const app = fakeApp();
      createPartyLayerSession({ provider: p as unknown as CIP0103Provider }).install(app);
      await flushPromises();
      expect(app.provide).toHaveBeenCalled(); // store still provided server-side
      expect(p.request).not.toHaveBeenCalled(); // but init() (status probe) skipped
    } finally {
      if (orig) Object.defineProperty(globalThis, 'window', orig);
    }
  });

  it('DOES init() when installed with window (client)', async () => {
    const p = mockProvider();
    const app = fakeApp();
    createPartyLayerSession({ provider: p as unknown as CIP0103Provider }).install(app);
    await flushPromises();
    expect(p.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'status' }));
  });
});
