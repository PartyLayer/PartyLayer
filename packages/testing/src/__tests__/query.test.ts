/**
 * TanStack Query test-utility coverage (@partylayer/testing/query).
 */
import { describe, expect, it } from 'vitest';
import {
  createQueryHarness,
  createTestQueryClient,
  expectInvalidated,
  getQueryState,
  trackOptimisticRollback,
} from '../query';

describe('createTestQueryClient', () => {
  it('applies test-friendly defaults (no retries, no caching window)', () => {
    const qc = createTestQueryClient();
    const d = qc.getDefaultOptions().queries;
    expect(d?.retry).toBe(false);
    expect(d?.gcTime).toBe(0);
    expect(d?.staleTime).toBe(0);
  });
});

describe('cache assertions', () => {
  it('getQueryState reflects data + invalidation', async () => {
    const qc = createTestQueryClient();
    await qc.fetchQuery({ queryKey: ['balance'], queryFn: async () => 42 });
    expect(getQueryState<number>(qc, ['balance']).data).toBe(42);
    expect(expectInvalidated(qc, ['balance'])).toBe(false);

    await qc.invalidateQueries({ queryKey: ['balance'] });
    expect(expectInvalidated(qc, ['balance'])).toBe(true);
  });
});

describe('trackOptimisticRollback', () => {
  it('captures the snapshot, applies an optimistic value, and rolls back', () => {
    const qc = createTestQueryClient();
    qc.setQueryData(['count'], 1);
    const t = trackOptimisticRollback<number>(qc, ['count']);
    expect(t.snapshot).toBe(1);

    t.apply(99);
    expect(t.current()).toBe(99); // optimistic write visible

    t.rollback();
    expect(t.current()).toBe(1); // restored
  });
});

describe('createQueryHarness', () => {
  it('composes the offline harness + a test QueryClient, fully offline', () => {
    const h = createQueryHarness({ wallet: { partyId: 'party::q' } });
    expect(h.provider).toBeDefined();
    expect(h.store.getSnapshot().status).toBe('disconnected');
    expect(h.queryClient).toBeDefined();
    h.destroy();
  });
});
