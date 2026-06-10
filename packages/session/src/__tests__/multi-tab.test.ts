/**
 * M1-S3 — multi-tab sync + party-switch + network-change invalidation.
 *
 * Crosses the grant's ≥8 lifecycle-scenario threshold:
 *   SCENARIO-8:  disconnect in tab A ⇒ tab B disconnected, NO rebroadcast.
 *   SCENARIO-9:  party switch ⇒ party:changed + persisted snapshot rewritten;
 *                list reorder (same primary) ⇒ NO event.
 *   SCENARIO-10: network change ⇒ network:changed + onInvalidate + snapshot updated.
 *   SCENARIO-11: no-BroadcastChannel env ⇒ everything still works single-tab.
 *
 * HERMETIC BY CONSTRUCTION: fake timers; zero real I/O; two channel instances
 * from a SYNCHRONOUS in-memory hub simulate two tabs (no-echo-to-sender, exactly
 * the BroadcastChannel semantic verified in STEP-0).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { createSessionStore } from '../store';
import { createMemoryStorage } from '../storage';
import { decodeSessionEnvelope } from '../session-envelope';
import type { BroadcastChannelLike, ChannelFactory } from '../broadcast';
import type { SessionEvent } from '../index';

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

/** Synchronous in-memory BroadcastChannel hub: delivers to OTHER instances only. */
function makeHub() {
  const instances = new Set<BroadcastChannelLike & { _name: string }>();
  let posts = 0;
  const factory: ChannelFactory = (name) => {
    const inst: BroadcastChannelLike & { _name: string } = {
      _name: name,
      onmessage: null,
      postMessage(data) {
        posts += 1;
        for (const other of instances) {
          if (other !== inst && other._name === name && other.onmessage) other.onmessage({ data });
        }
      },
      close() {
        instances.delete(inst);
      },
    };
    instances.add(inst);
    return inst;
  };
  return { factory, posts: () => posts };
}

function mockProvider() {
  const ls = new Map<string, Set<(...a: unknown[]) => void>>();
  let connected = true;
  const p = {
    on(e: string, l: (...a: unknown[]) => void) {
      (ls.get(e) ?? ls.set(e, new Set()).get(e)!).add(l);
      return p;
    },
    removeListener(e: string, l: (...a: unknown[]) => void) {
      ls.get(e)?.delete(l);
      return p;
    },
    emit(e: string, ...args: unknown[]) {
      ls.get(e)?.forEach((l) => l(...args));
    },
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'status') return { connection: { isConnected: connected }, network: { networkId: 'canton:da-devnet' } };
      if (method === 'listAccounts') return [acct('party::a')];
      if (method === 'disconnect') connected = false;
      return {};
    }),
  };
  return p;
}

const make = (p: ReturnType<typeof mockProvider>, opts: Parameters<typeof createSessionStore>[1] = {}) =>
  createSessionStore(p as unknown as CIP0103Provider, opts);

async function establish(store: ReturnType<typeof createSessionStore>, p: ReturnType<typeof mockProvider>, net = 'net-1') {
  await store.connect();
  p.emit('accountsChanged', [acct('party::a')]);
  p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: net } });
}

function collect(store: ReturnType<typeof createSessionStore>): SessionEvent[] {
  const out: SessionEvent[] = [];
  for (const t of ['party:changed', 'network:changed'] as const) store.on(t, (e) => out.push(e));
  return out;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SCENARIO-8: disconnect in tab A → tab B disconnected, no rebroadcast', () => {
  it('propagates disconnect across tabs without echo loop', async () => {
    const hub = makeHub();
    const pA = mockProvider();
    const pB = mockProvider();
    const tabA = make(pA, { broadcast: { channelFactory: hub.factory } });
    const tabB = make(pB, { broadcast: { channelFactory: hub.factory } });
    await establish(tabA, pA);
    await establish(tabB, pB);
    expect(tabB.getSnapshot().status).toBe('connected');

    await tabA.disconnect();

    expect(tabA.getSnapshot().status).toBe('disconnected');
    expect(tabB.getSnapshot().status).toBe('disconnected'); // propagated
    expect(hub.posts()).toBe(1); // exactly ONE broadcast — tab B did NOT rebroadcast
    tabA.destroy();
    tabB.destroy();
  });
});

describe('SCENARIO-9: party switch → event + snapshot rewrite; reorder → no event', () => {
  it('primary partyId change emits party:changed and rewrites the snapshot', async () => {
    const p = mockProvider();
    const storage = createMemoryStorage();
    const store = make(p, { storage, persistSnapshot: true });
    const events = collect(store);
    await establish(store, p);

    p.emit('accountsChanged', [acct('party::b')]); // SWITCH a → b
    expect(events).toContainEqual({ type: 'party:changed', previous: 'party::a', current: 'party::b' });

    const raw = await storage.getItem('partylayer.session.connected');
    const snap = decodeSessionEnvelope(raw as string);
    expect(snap?.account?.partyId).toBe('party::b'); // snapshot rewritten
    store.destroy();
  });

  it('a list reorder that keeps the same primary emits NO party:changed', async () => {
    const p = mockProvider();
    const store = make(p, {});
    const events = collect(store);
    await establish(store, p);

    // same primary (b), just reordered with a secondary — not a switch
    p.emit('accountsChanged', [acct('party::b'), acct('party::c', false)]);
    p.emit('accountsChanged', [acct('party::c', false), acct('party::b')]); // reorder
    const switches = events.filter((e) => e.type === 'party:changed');
    // only the initial a→b is a switch; the reorder is NOT
    expect(switches).toEqual([{ type: 'party:changed', previous: 'party::a', current: 'party::b' }]);
    store.destroy();
  });
});

describe('SCENARIO-10: network change → event + onInvalidate + snapshot update', () => {
  it('networkId delta emits network:changed, calls onInvalidate, rewrites snapshot', async () => {
    const p = mockProvider();
    const storage = createMemoryStorage();
    const onInvalidate = vi.fn();
    const store = make(p, { storage, persistSnapshot: true, onInvalidate });
    const events = collect(store);
    await establish(store, p, 'net-1');

    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'net-2' } });

    expect(events).toContainEqual({ type: 'network:changed', previous: 'net-1', current: 'net-2' });
    expect(onInvalidate).toHaveBeenCalledWith({ type: 'network:changed', previous: 'net-1', current: 'net-2' });
    const snap = decodeSessionEnvelope((await storage.getItem('partylayer.session.connected')) as string);
    expect(snap?.networkId).toBe('net-2');
    store.destroy();
  });
});

describe('SCENARIO-11: no BroadcastChannel → single-tab still works (graceful no-op)', () => {
  it('factory returning null → no crash; party/network events still emit locally', async () => {
    const p = mockProvider();
    // Simulate an env without BroadcastChannel.
    const store = make(p, { broadcast: { channelFactory: () => null } });
    const events = collect(store);
    await establish(store, p, 'net-1');

    p.emit('accountsChanged', [acct('party::b')]);
    p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'net-2' } });
    await expect(store.disconnect()).resolves.toBeUndefined(); // no throw

    expect(events.some((e) => e.type === 'party:changed')).toBe(true);
    expect(events.some((e) => e.type === 'network:changed')).toBe(true);
    expect(store.getSnapshot().status).toBe('disconnected');
    store.destroy();
  });
});
