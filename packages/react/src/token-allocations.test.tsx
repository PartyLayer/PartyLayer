// @vitest-environment jsdom
/**
 * useTokenAllocations tests: a CIP-0056 typed specialization of useDamlContract for
 * the AllocationV1 interface (the read-side allocation sibling of useTokenHoldings).
 * Mirrors the token-holdings test. Covers: the hook wraps the dApp's read fetcher
 * and exposes the TanStack shape plus an `allocations` alias; a resolved
 * TokenAllocation[] populates allocations; read resolving null yields
 * allocations=null (successful, not an error); read rejecting yields isError; the
 * queryKey folds in the opaque key so different keys cache independently; and
 * passthrough query options (e.g. enabled:false) are respected. Model 2: rendered
 * with only a QueryClientProvider (no PartyLayerProvider), proving no client access.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useTokenAllocations, type TokenAllocation } from './token-allocations';
import { partyLayerKeys } from './query-keys';

const allocations: TokenAllocation[] = [
  {
    allocation: {
      settlement: {
        executor: 'party::executor-1',
        settlementRef: { id: 'settlement-1', cid: '00settlementCid' },
        requestedAt: '2026-07-22T00:00:00Z',
        allocateBefore: '2026-07-22T01:00:00Z',
        settleBefore: '2026-07-22T02:00:00Z',
      },
      transferLegId: 'leg-1',
      transferLeg: {
        sender: 'party::sender-1',
        receiver: 'party::receiver-1',
        amount: '42.5',
        instrumentId: { admin: 'party::registry-admin', id: 'USDC' },
      },
    },
    holdingCids: ['00holdingA', '00holdingB'],
    meta: { source: 'dex' },
  },
  {
    allocation: {
      settlement: {
        executor: 'party::executor-1',
        settlementRef: { id: 'settlement-2' }, // cid omitted (Optional)
        requestedAt: '2026-07-22T00:00:00Z',
        allocateBefore: '2026-07-22T01:00:00Z',
        settleBefore: '2026-07-22T02:00:00Z',
      },
      transferLegId: 'leg-2',
      transferLeg: {
        sender: 'party::sender-1',
        receiver: 'party::receiver-2',
        amount: '1000',
        instrumentId: { admin: 'party::registry-admin', id: 'CC' },
      },
    },
    holdingCids: [], // MAY be empty for registries not representing holdings on-ledger
  },
];

/**
 * Fresh QueryClient per call; retries off so error/loading tests are deterministic.
 * NOTE: only a QueryClientProvider, deliberately NO PartyLayerProvider. The hook
 * works here purely because it never touches the PartyLayer client (Model 2).
 */
function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useTokenAllocations (CIP-0056 typed read, dApp-supplied read fetcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps the read fetcher and exposes the TanStack shape + alias (allocations === data) on success', async () => {
    const reader = vi.fn().mockResolvedValue(allocations);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenAllocations({ read: reader }), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    expect('data' in result.current).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.allocations).toEqual(allocations); // alias === data
    expect(result.current.data).toEqual(allocations);
    // Typed shape flows through: nested settlement + transfer leg + decimal amount.
    expect(result.current.allocations?.[0].allocation.transferLeg.instrumentId.id).toBe('USDC');
    expect(result.current.allocations?.[0].allocation.transferLeg.amount).toBe('42.5');
    expect(result.current.allocations?.[0].allocation.settlement.settlementRef.cid).toBe('00settlementCid');
    expect(result.current.allocations?.[1].holdingCids).toEqual([]);
  });

  it('queryFn calls the provided read fetcher with the AbortSignal (no PartyLayer client involved)', async () => {
    const reader = vi.fn().mockResolvedValue(allocations);
    const { wrapper } = makeWrapper();
    // Renders with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result } = renderHook(() => useTokenAllocations({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('null allocations (none yet/absent): allocations === null, isSuccess true (not an error)', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenAllocations({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.allocations).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('empty array is a valid successful result distinct from null', async () => {
    const reader = vi.fn().mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenAllocations({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.allocations).toEqual([]);
    expect(result.current.allocations).not.toBeNull();
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('acs query failed');
    const reader = vi.fn().mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenAllocations({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.allocations).toBeUndefined();
  });

  it('isPending toggles true while pending, then false', async () => {
    let resolve: (v: TokenAllocation[] | null) => void = () => {};
    const reader = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenAllocations({ read: reader }), { wrapper });

    expect(result.current.isPending).toBe(true);
    act(() => resolve(allocations));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('opaque key scopes the cache (different keys cache independently)', async () => {
    const readerA = vi.fn().mockResolvedValue(allocations);
    const otherAllocations: TokenAllocation[] = [
      {
        allocation: {
          settlement: {
            executor: 'party::executor-2',
            settlementRef: { id: 'settlement-9' },
            requestedAt: '2026-07-22T00:00:00Z',
            allocateBefore: '2026-07-22T01:00:00Z',
            settleBefore: '2026-07-22T02:00:00Z',
          },
          transferLegId: 'leg-9',
          transferLeg: {
            sender: 'party::sender-9',
            receiver: 'party::receiver-9',
            amount: '7',
            instrumentId: { admin: 'party::registry-admin', id: 'CC' },
          },
        },
        holdingCids: ['00holdingZ'],
      },
    ];
    const readerB = vi.fn().mockResolvedValue(otherAllocations);
    const { queryClient, wrapper } = makeWrapper();

    const a = renderHook(() => useTokenAllocations({ read: readerA, key: 'executor-1' }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    const b = renderHook(() => useTokenAllocations({ read: readerB, key: 'executor-2' }), { wrapper });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    // both fetchers ran (no cache collision between the two keys)
    expect(readerA).toHaveBeenCalledTimes(1);
    expect(readerB).toHaveBeenCalledTimes(1);
    // each cached under its own key-scoped queryKey
    expect(queryClient.getQueryData(partyLayerKeys.tokenAllocations({ key: 'executor-1' }))).toEqual(allocations);
    expect(queryClient.getQueryData(partyLayerKeys.tokenAllocations({ key: 'executor-2' }))).toEqual(otherAllocations);
  });

  it('respects passthrough query options (enabled:false does not fetch)', async () => {
    const reader = vi.fn().mockResolvedValue(allocations);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useTokenAllocations({ read: reader, query: { enabled: false } }),
      { wrapper },
    );
    // enabled:false: the query never runs, so the fetcher is not called.
    expect(reader).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.allocations).toBeUndefined();
  });
});
