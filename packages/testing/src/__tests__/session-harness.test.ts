/**
 * Session-lifecycle harness tests — every scenario drives the REAL session
 * store. Hermetic: fake timers, in-memory storage, injected broadcast hub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionEvent } from '@partylayer/session';
import { createSessionHarness } from '../session-harness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const advanceTimers = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('createSessionHarness', () => {
  it('expire() drives the store\'s REAL expiry timer → session:expired + onReauthRequired', async () => {
    const onReauthRequired = vi.fn();
    const h = createSessionHarness({ ttlMs: 30_000, onReauthRequired, advanceTimers });
    const events: SessionEvent[] = [];
    h.store.on('session:expired', (e) => events.push(e));
    await h.connect();

    await h.expire(); // advances the real setTimeout(ttlMs) — no synthetic emit

    expect(events.some((e) => e.type === 'session:expired')).toBe(true);
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
    h.destroy();
  });

  it('expire() without advanceTimers throws a clear error', async () => {
    const h = createSessionHarness({ ttlMs: 1000 }); // no advanceTimers
    await h.connect();
    await expect(h.expire()).rejects.toThrow(/advanceTimers/);
    h.destroy();
  });

  it('switchParty() fires a real accountsChanged → party:changed delta', async () => {
    const h = createSessionHarness({ partyId: 'party::a', advanceTimers });
    const changes: SessionEvent[] = [];
    h.store.on('party:changed', (e) => changes.push(e));
    await h.connect();

    h.switchParty('party::b');

    expect(changes).toContainEqual({ type: 'party:changed', previous: 'party::a', current: 'party::b' });
    h.destroy();
  });

  it('dropConnection() is a transient drop → reconnect is scheduled (not explicit disconnect)', async () => {
    const h = createSessionHarness({
      reconnect: { baseDelayMs: 1000, factor: 2, maxDelayMs: 5000, maxAttempts: 3, jitter: false },
      advanceTimers,
    });
    const scheduled: SessionEvent[] = [];
    h.store.on('reconnect:scheduled', (e) => scheduled.push(e));
    await h.connect();

    h.dropConnection();

    expect(scheduled.length).toBeGreaterThan(0);
    expect(h.store.getSnapshot().status).toBe('reconnecting');
    h.destroy();
  });

  it('openTab(): a disconnect in one tab propagates to the other (shared broadcast hub)', async () => {
    const tabA = createSessionHarness({ advanceTimers });
    const tabB = tabA.openTab();
    await tabA.connect();
    await tabB.connect();
    expect(tabB.store.getSnapshot().status).toBe('connected');

    await tabA.store.disconnect(); // explicit disconnect propagates cross-tab

    expect(tabB.store.getSnapshot().status).toBe('disconnected');
    tabA.destroy();
    tabB.destroy(); // per-harness teardown — children are NOT torn down with the parent
  });
});
