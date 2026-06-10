/**
 * M1-S2 — session resilience (grant Milestone 1, slice 2).
 *
 * Continues the grant's ≥8 session lifecycle scenarios:
 *   SCENARIO-4: runtime expiry → session:expired + onReauthRequired + state
 *               preserved; successful re-auth resumes.
 *   SCENARIO-5: transient disconnect → exponential backoff at EXACT offsets
 *               (incl. the maxDelayMs cap); success at attempt k restores state.
 *   SCENARIO-6: maxAttempts exhausted → reconnect:gaveup + terminal; manual
 *               cancel mid-backoff stops further attempts.
 *   SCENARIO-7: op issued during re-auth queues + completes after success;
 *               overflow + re-auth-failure reject with clear errors.
 *   Invariant:  an EXPLICIT user disconnect NEVER schedules a reconnect.
 *
 * HERMETIC BY CONSTRUCTION: vi.useFakeTimers everywhere — zero real I/O/waits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { createSessionStore } from '../store';
import type { RetryPolicy, SessionEvent } from '../index';

const ACCT: CIP0103Account = {
  primary: true,
  partyId: 'party::a',
  status: 'allocated' as CIP0103Account['status'],
  hint: 'h',
  publicKey: 'pk',
  namespace: 'ns',
  networkId: 'canton:da-devnet',
  signingProviderId: 'webauthn-prf',
};

/** Controllable mock CIP-0103 provider: event bus + scriptable `status`. */
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
      return true;
    },
    request: vi.fn(async ({ method }: { method: string }) => {
      switch (method) {
        case 'status':
          return { connection: { isConnected: connected }, network: { networkId: 'canton:da-devnet' } };
        case 'listAccounts':
          return [ACCT];
        case 'connect':
          connected = true;
          return {};
        case 'disconnect':
          connected = false;
          return null;
        case 'getActiveNetwork':
          return { networkId: 'canton:da-devnet' };
        default:
          return {};
      }
    }),
    // test controls
    setConnected(v: boolean) {
      connected = v;
    },
    drop() {
      // a TRANSIENT, provider-driven disconnect
      connected = false;
      p.emit('statusChanged', { connection: { isConnected: false } });
    },
  };
  return p;
}

function makeStore(provider: ReturnType<typeof mockProvider>, opts: Parameters<typeof createSessionStore>[1] = {}) {
  return createSessionStore(provider as unknown as CIP0103Provider, opts);
}

async function establishConnected(store: ReturnType<typeof createSessionStore>, p: ReturnType<typeof mockProvider>) {
  await store.connect();
  p.emit('accountsChanged', [ACCT]);
  p.emit('statusChanged', { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } });
}

function collect(store: ReturnType<typeof createSessionStore>): SessionEvent[] {
  const events: SessionEvent[] = [];
  for (const t of ['reconnect:scheduled', 'reconnect:attempt', 'reconnect:succeeded', 'reconnect:gaveup', 'session:expired'] as const) {
    store.on(t, (e) => events.push(e));
  }
  return events;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const FAST: RetryPolicy = { baseDelayMs: 1000, factor: 2, maxDelayMs: 5000, maxAttempts: 5, jitter: false };

describe('SCENARIO-5: transient disconnect → backoff at exact offsets + success restores', () => {
  it('schedules 1000,2000,4000,5000(capped) and succeeds at attempt 4', async () => {
    const p = mockProvider();
    const store = makeStore(p, { reconnect: FAST });
    const events = collect(store);
    await establishConnected(store, p);

    p.drop(); // transient
    expect(store.getSnapshot().status).toBe('reconnecting');
    const scheduled = () => events.filter((e) => e.type === 'reconnect:scheduled') as Array<{ delayMs: number; attempt: number }>;
    expect(scheduled()[0]).toMatchObject({ attempt: 1, delayMs: 1000 });

    // attempts 1..3 fail (provider still down) → schedules 2000, 4000, 5000(capped)
    await vi.advanceTimersByTimeAsync(1000); // attempt 1
    expect(scheduled()[1]).toMatchObject({ attempt: 2, delayMs: 2000 });
    await vi.advanceTimersByTimeAsync(2000); // attempt 2
    expect(scheduled()[2]).toMatchObject({ attempt: 3, delayMs: 4000 });
    await vi.advanceTimersByTimeAsync(4000); // attempt 3
    expect(scheduled()[3]).toMatchObject({ attempt: 4, delayMs: 5000 }); // capped (8000→5000)

    // provider recovers → attempt 4 succeeds
    p.setConnected(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(events.some((e) => e.type === 'reconnect:succeeded' && e.attempt === 4)).toBe(true);
    expect(store.getSnapshot().status).toBe('connected');
    expect(store.getSnapshot().account?.partyId).toBe('party::a');
    store.destroy();
  });
});

describe('SCENARIO-6: give up after maxAttempts + manual cancel mid-backoff', () => {
  it('exhausts 3 attempts → reconnect:gaveup + disconnected (terminal)', async () => {
    const p = mockProvider();
    const store = makeStore(p, { reconnect: { ...FAST, maxAttempts: 3 } });
    const events = collect(store);
    await establishConnected(store, p);

    p.drop(); // stays down forever
    await vi.advanceTimersByTimeAsync(1000); // attempt 1
    await vi.advanceTimersByTimeAsync(2000); // attempt 2
    await vi.advanceTimersByTimeAsync(4000); // attempt 3 → next would be #4 > max
    const gaveup = events.find((e) => e.type === 'reconnect:gaveup');
    expect(gaveup).toMatchObject({ type: 'reconnect:gaveup', attempts: 3 });
    expect(store.getSnapshot().status).toBe('disconnected');
    store.destroy();
  });

  it('manual disconnect mid-backoff stops further attempts', async () => {
    const p = mockProvider();
    const store = makeStore(p, { reconnect: FAST });
    const events = collect(store);
    await establishConnected(store, p);

    p.drop();
    expect(events.filter((e) => e.type === 'reconnect:scheduled')).toHaveLength(1);
    await store.disconnect(); // explicit cancel mid-backoff
    await vi.advanceTimersByTimeAsync(60_000); // let any stale timer fire
    expect(events.filter((e) => e.type === 'reconnect:attempt')).toHaveLength(0);
    expect(events.some((e) => e.type === 'reconnect:succeeded')).toBe(false);
    store.destroy();
  });
});

describe('invariant: explicit user disconnect NEVER schedules reconnect', () => {
  it('disconnect() then a stray statusChanged(false) → no reconnect', async () => {
    const p = mockProvider();
    const store = makeStore(p, { reconnect: FAST });
    const events = collect(store);
    await establishConnected(store, p);

    await store.disconnect();
    p.emit('statusChanged', { connection: { isConnected: false } }); // stray event
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events.filter((e) => e.type === 'reconnect:scheduled')).toHaveLength(0);
    store.destroy();
  });
});

describe('SCENARIO-4: runtime expiry → session:expired + onReauthRequired + resume', () => {
  it('emits session:expired, invokes re-auth, preserves account, resumes', async () => {
    const p = mockProvider();
    const onReauthRequired = vi.fn(async () => {
      p.setConnected(true); // app performs re-auth
    });
    const store = makeStore(p, { expiry: { ttlMs: 10_000, onReauthRequired } });
    const events = collect(store);
    await establishConnected(store, p);
    expect(store.getSnapshot().account?.partyId).toBe('party::a');

    await vi.advanceTimersByTimeAsync(10_000); // expiry fires
    expect(events.some((e) => e.type === 'session:expired')).toBe(true);
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
    // account preserved across re-auth (only status changed)
    expect(store.getSnapshot().account?.partyId).toBe('party::a');
    store.destroy();
  });
});

describe('SCENARIO-7: enqueue during re-auth — resume / overflow / failure', () => {
  it('op queued during re-auth runs after success', async () => {
    const p = mockProvider();
    let release: () => void = () => {};
    const reauthGate = new Promise<void>((r) => (release = r));
    const store = makeStore(p, { expiry: { ttlMs: 1000, onReauthRequired: async () => reauthGate } });
    await establishConnected(store, p);

    await vi.advanceTimersByTimeAsync(1000); // expiry → reauthInProgress = true
    const ran: string[] = [];
    const queued = store.enqueue(async () => {
      ran.push('op');
      return 'done';
    });
    expect(ran).toEqual([]); // held while re-auth in progress

    release(); // re-auth succeeds
    await expect(queued).resolves.toBe('done');
    expect(ran).toEqual(['op']);
    store.destroy();
  });

  it('overflow beyond pendingQueueSize rejects with a clear error', async () => {
    const p = mockProvider();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const store = makeStore(p, { expiry: { ttlMs: 1000, pendingQueueSize: 2, onReauthRequired: async () => gate } });
    await establishConnected(store, p);
    await vi.advanceTimersByTimeAsync(1000);

    const a = store.enqueue(async () => 'a');
    const b = store.enqueue(async () => 'b');
    const c = store.enqueue(async () => 'c'); // overflow (max 2)
    await expect(c).rejects.toThrow(/pending queue full/i);
    release();
    await expect(a).resolves.toBe('a');
    await expect(b).resolves.toBe('b');
    store.destroy();
  });

  it('re-auth failure rejects queued ops with a clear error', async () => {
    const p = mockProvider();
    let fail: (e: Error) => void = () => {};
    const gate = new Promise<void>((_, rej) => (fail = rej));
    const store = makeStore(p, { expiry: { ttlMs: 1000, onReauthRequired: async () => gate } });
    await establishConnected(store, p);
    await vi.advanceTimersByTimeAsync(1000);

    const queued = store.enqueue(async () => 'never');
    fail(new Error('re-auth denied'));
    await expect(queued).rejects.toThrow(/re-authentication failed/i);
    expect(store.getSnapshot().status).toBe('disconnected');
    store.destroy();
  });

  it('enqueue runs immediately when no re-auth is in progress', async () => {
    const p = mockProvider();
    const store = makeStore(p, {});
    await establishConnected(store, p);
    await expect(store.enqueue(async () => 42)).resolves.toBe(42);
    store.destroy();
  });
});
