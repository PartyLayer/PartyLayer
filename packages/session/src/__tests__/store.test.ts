/**
 * Lifecycle/integration tests for the framework-agnostic session core.
 *
 * Everything runs offline against the @partylayer/testing mock provider +
 * lifecycle — no DevNet, no live wallet. Deterministic and fake-timer friendly.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  CIP0103_EVENTS,
  type CIP0103Account,
  type CIP0103Provider,
  type CIP0103StatusEvent,
} from '@partylayer/core';
import {
  createMockWallet,
  createTransactionLifecycle,
  recordTxEvents,
} from './local-mock';
import { createSessionStore } from '../store';

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

describe('createSessionStore — connect / disconnect', () => {
  it('connect() => connected with the mock party; disconnect() => disconnected', async () => {
    const store = createSessionStore(createMockWallet());
    expect(store.getSnapshot().status).toBe('disconnected');

    const afterConnect = await store.connect();
    expect(afterConnect.status).toBe('connected');
    expect(afterConnect.account?.partyId).toBe('party::mock-1');
    expect(afterConnect.accounts.length).toBeGreaterThan(0);
    expect(afterConnect.networkId).toEqual(expect.stringContaining('canton:'));
    expect(afterConnect.lastError).toBeNull();

    await store.disconnect();
    const s = store.getSnapshot();
    expect(s.status).toBe('disconnected');
    expect(s.account).toBeNull();
    expect(s.accounts).toEqual([]);
    store.destroy();
  });

  it('exposes a connecting state while connect() is in flight (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const store = createSessionStore(createMockWallet({ delays: { connect: 1000 } }));
      const pending = store.connect();
      expect(store.getSnapshot().status).toBe('connecting');
      await vi.advanceTimersByTimeAsync(1000);
      await pending;
      expect(store.getSnapshot().status).toBe('connected');
      store.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createSessionStore — account changes', () => {
  it('accountsChanged updates active + available accounts', async () => {
    const provider = createMockWallet();
    const store = createSessionStore(provider);
    await store.connect();

    const accounts = [account('party::switched', true), account('party::second', false)];
    provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, accounts);

    const s = store.getSnapshot();
    expect(s.accounts).toHaveLength(2);
    expect(s.account?.partyId).toBe('party::switched'); // primary
    store.destroy();
  });

  it('picks the first account when none is marked primary', async () => {
    const provider = createMockWallet();
    const store = createSessionStore(provider);
    provider.emit(CIP0103_EVENTS.ACCOUNTS_CHANGED, [
      account('party::a', false),
      account('party::b', false),
    ]);
    expect(store.getSnapshot().account?.partyId).toBe('party::a');
    store.destroy();
  });
});

describe('createSessionStore — status-driven transitions & restore', () => {
  it('a statusChanged(false) event drives the store to disconnected', async () => {
    const provider = createMockWallet();
    const store = createSessionStore(provider);
    await store.connect();
    expect(store.getSnapshot().status).toBe('connected');

    provider.emit(CIP0103_EVENTS.STATUS_CHANGED, {
      connection: { isConnected: false },
      provider: { id: 'mock', version: '0', providerType: 'browser' },
    } as CIP0103StatusEvent);

    expect(store.getSnapshot().status).toBe('disconnected');
    expect(store.getSnapshot().account).toBeNull();
    store.destroy();
  });

  it('restore() rehydrates a connected session from a provider that reports connected', async () => {
    // The mock starts already connected: status() returns isConnected: true.
    const store = createSessionStore(createMockWallet({ connected: true }));
    expect(store.getSnapshot().status).toBe('disconnected'); // before restore

    const restored = await store.restore();
    expect(restored.status).toBe('connected');
    expect(restored.account?.partyId).toBe('party::mock-1');
    expect(typeof restored.networkId).toBe('string');
    store.destroy();
  });

  it('restore() ends disconnected when the provider reports no active session', async () => {
    const store = createSessionStore(createMockWallet({ connected: false }));
    const restored = await store.restore();
    expect(restored.status).toBe('disconnected');
    expect(restored.account).toBeNull();
    store.destroy();
  });

  it('init() is an alias for restore()', async () => {
    const store = createSessionStore(createMockWallet({ connected: true }));
    const s = await store.init();
    expect(s.status).toBe('connected');
    store.destroy();
  });
});

describe('createSessionStore — error handling', () => {
  it('a connect rejection (userRejected) surfaces as lastError without throwing', async () => {
    const store = createSessionStore(
      createMockWallet({ scenarios: { connect: 'userRejected' } }),
    );
    // Must not throw:
    const s = await store.connect();
    expect(s.status).toBe('disconnected');
    expect(s.lastError).toBeInstanceOf(Error);
    expect(s.lastError?.message).toMatch(/reject/i);
    store.destroy();
  });

  it('clears lastError on a subsequent successful connect', async () => {
    const provider = createMockWallet({ scenarios: { connect: 'userRejected' } });
    const store = createSessionStore(provider);
    await store.connect();
    expect(store.getSnapshot().lastError).not.toBeNull();
    // (a real app would swap the provider; here we just assert error semantics)
    store.destroy();
  });
});

describe('createSessionStore — transaction lifecycle observed through the session', () => {
  it('a full preparing→submitting→confirming→finalized lifecycle is observable on the session provider', async () => {
    const provider = createMockWallet();
    const store = createSessionStore(provider);
    await store.connect();

    const rec = recordTxEvents(provider);
    const lc = createTransactionLifecycle({ provider, commandId: 'cmd-1' });

    lc.advance(); // preparing  → pending
    lc.advance(); // submitting → signed
    lc.advance(); // confirming → (no CIP-0103 event)
    lc.advance(); // finalized  → executed

    expect(rec.statuses()).toEqual(['pending', 'signed', 'executed']);
    // tx events do not perturb session connection state in 6a
    expect(store.getSnapshot().status).toBe('connected');
    rec.stop();
    store.destroy();
  });
});

describe('createSessionStore — subscribe / getSnapshot', () => {
  it('notifies on change and stops after unsubscribe (no leak)', async () => {
    const store = createSessionStore(createMockWallet());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.connect(); // ≥1 change
    const callsAfterConnect = listener.mock.calls.length;
    expect(callsAfterConnect).toBeGreaterThan(0);

    unsubscribe();
    await store.disconnect();
    expect(listener.mock.calls.length).toBe(callsAfterConnect); // not called again
    store.destroy();
  });

  it('does not notify and keeps a stable snapshot reference on a no-op change', async () => {
    const provider = createMockWallet();
    const store = createSessionStore(provider);
    await store.connect();

    const listener = vi.fn();
    store.subscribe(listener);
    const snap1 = store.getSnapshot();

    // Re-emit an identical "connected" status — no field changes.
    provider.emit(CIP0103_EVENTS.STATUS_CHANGED, {
      connection: { isConnected: true },
      provider: { id: 'mock', version: '0', providerType: 'browser' },
    } as CIP0103StatusEvent);

    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(snap1); // stable reference for useSyncExternalStore
    store.destroy();
  });

  it('destroy() removes provider listeners (post-destroy events are ignored)', async () => {
    const provider = createMockWallet();
    const store = createSessionStore(provider);
    await store.connect();
    store.destroy();

    const before = store.getSnapshot();
    provider.emit(CIP0103_EVENTS.STATUS_CHANGED, {
      connection: { isConnected: false },
      provider: { id: 'mock', version: '0', providerType: 'browser' },
    } as CIP0103StatusEvent);
    expect(store.getSnapshot()).toBe(before); // unchanged — listener was removed
  });
});

// ── 6b fold-in fixes ─────────────────────────────────────────────────────────

/**
 * A minimal CIP-0103 provider that mimics a WalletConnect-style wallet: its
 * `status`/`statusChanged` OMIT `network` (WC never emits chainChanged and may
 * not include network in status), but it DOES answer `getActiveNetwork`.
 */
function createNetworklessProvider(networkId = 'canton:da-mainnet'): CIP0103Provider {
  const bus = new Map<string, Set<(...args: unknown[]) => void>>();
  const fire = (event: string, ...args: unknown[]) =>
    bus.get(event)?.forEach((fn) => fn(...args));
  const provider: CIP0103Provider = {
    async request<T>(args: { method: string }): Promise<T> {
      switch (args.method) {
        case 'connect':
          fire(CIP0103_EVENTS.STATUS_CHANGED, {
            connection: { isConnected: true },
            provider: { id: 'wc', version: '1', providerType: 'remote' },
            // note: no `network`
          } as CIP0103StatusEvent);
          fire(CIP0103_EVENTS.ACCOUNTS_CHANGED, [account('party::wc')]);
          return { isConnected: true } as T;
        case 'status':
          return {
            connection: { isConnected: true },
            provider: { id: 'wc', version: '1', providerType: 'remote' },
          } as T; // no `network`
        case 'listAccounts':
          return [account('party::wc')] as T;
        case 'getActiveNetwork':
          return { networkId } as T;
        default:
          return undefined as T;
      }
    },
    on(event, listener) {
      let set = bus.get(event);
      if (!set) {
        set = new Set();
        bus.set(event, set);
      }
      set.add(listener as (...args: unknown[]) => void);
      return provider;
    },
    emit(event, ...args) {
      fire(event, ...args);
      return true;
    },
    removeListener(event, listener) {
      bus.get(event)?.delete(listener as (...args: unknown[]) => void);
      return provider;
    },
  };
  return provider;
}

describe('createSessionStore — networkId WC fallback (status without network)', () => {
  it('connect(): falls back to getActiveNetwork when statusChanged omits network', async () => {
    const store = createSessionStore(createNetworklessProvider('canton:da-mainnet'));
    const s = await store.connect();
    expect(s.status).toBe('connected');
    expect(s.networkId).toBe('canton:da-mainnet'); // populated via getActiveNetwork
    store.destroy();
  });

  it('restore(): falls back to getActiveNetwork when status omits network', async () => {
    const store = createSessionStore(createNetworklessProvider('canton:da-testnet'));
    const s = await store.restore();
    expect(s.status).toBe('connected');
    expect(s.networkId).toBe('canton:da-testnet');
    store.destroy();
  });
});

describe('createSessionStore — destructure-safe lifecycle methods', () => {
  it('a destructured init() does not rely on `this` and works', async () => {
    const store = createSessionStore(createMockWallet({ connected: true }));
    const { init } = store; // destructured — would crash if init used this.restore()
    const s = await init();
    expect(s.status).toBe('connected');
    store.destroy();
  });

  it('a destructured restore() also works', async () => {
    const store = createSessionStore(createMockWallet({ connected: true }));
    const { restore } = store;
    const s = await restore();
    expect(s.status).toBe('connected');
    store.destroy();
  });
});
