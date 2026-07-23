// @vitest-environment jsdom
/**
 * useAllocationRequests tests: a CIP-0056 typed read hook for pending allocation
 * requests, mirroring the token-transfer-instructions test. Covers: wraps the read
 * fetcher and exposes the TanStack shape plus a `requests` alias; a resolved ref
 * list populates requests; null yields requests=null (success, not error); a
 * rejection yields isError; the queryKey folds in the opaque key so different keys
 * cache independently; enabled:false is respected. Model 2: rendered with only a
 * QueryClientProvider.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useAllocationRequests,
  type TokenAllocationRequestRef,
} from './token-allocation-requests';
import { partyLayerKeys } from './query-keys';

const requests: TokenAllocationRequestRef[] = [
  {
    cid: 'ar-cid-1',
    request: {
      settlement: {
        executor: 'party::executor-1',
        settlementRef: { id: 'settlement-1', cid: '00settlementCid' },
        requestedAt: '2026-07-22T09:00:00Z',
        allocateBefore: '2027-01-01T00:00:00Z',
        settleBefore: '2027-01-01T00:00:00Z',
      },
      transferLegs: {
        'leg-1': {
          sender: 'party::sender-1',
          receiver: 'party::receiver-1',
          amount: '42.5',
          instrumentId: { admin: 'party::registry-admin', id: 'USDC' },
        },
        'leg-2': {
          sender: 'party::sender-2',
          receiver: 'party::receiver-2',
          amount: '10',
          instrumentId: { admin: 'party::registry-admin', id: 'CC' },
        },
      },
      meta: { trade: 'demo' },
    },
  },
];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useAllocationRequests (CIP-0056 typed request read, Model 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps the read fetcher and exposes the TanStack shape + alias (requests === data)', async () => {
    const reader = vi.fn().mockResolvedValue(requests);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllocationRequests({ read: reader }), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.requests).toEqual(requests);
    expect(result.current.data).toEqual(requests);
    // Typed ref shape flows through: cid + view (settlement + legs record keyed by leg id).
    expect(result.current.requests?.[0].cid).toBe('ar-cid-1');
    expect(result.current.requests?.[0].request.transferLegs['leg-1'].instrumentId.id).toBe('USDC');
    expect(Object.keys(result.current.requests![0].request.transferLegs)).toEqual(['leg-1', 'leg-2']);
  });

  it('queryFn calls the read fetcher with the AbortSignal (no PartyLayer client involved)', async () => {
    const reader = vi.fn().mockResolvedValue(requests);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllocationRequests({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('null requests (none yet/absent): requests === null, isSuccess true (not an error)', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllocationRequests({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.requests).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('acs query failed');
    const reader = vi.fn().mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllocationRequests({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.requests).toBeUndefined();
  });

  it('isPending toggles true while pending, then false', async () => {
    let resolve: (v: TokenAllocationRequestRef[] | null) => void = () => {};
    const reader = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAllocationRequests({ read: reader }), { wrapper });

    expect(result.current.isPending).toBe(true);
    act(() => resolve(requests));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('opaque key scopes the cache (different keys cache independently)', async () => {
    const readerA = vi.fn().mockResolvedValue(requests);
    const otherRequests: TokenAllocationRequestRef[] = [
      {
        cid: 'ar-cid-9',
        request: {
          settlement: {
            executor: 'party::executor-2',
            settlementRef: { id: 'settlement-9' },
            requestedAt: '2026-07-22T09:00:00Z',
            allocateBefore: '2027-01-01T00:00:00Z',
            settleBefore: '2027-01-01T00:00:00Z',
          },
          transferLegs: {
            'leg-9': {
              sender: 'party::sender-9',
              receiver: 'party::receiver-9',
              amount: '7',
              instrumentId: { admin: 'party::registry-admin', id: 'CC' },
            },
          },
        },
      },
    ];
    const readerB = vi.fn().mockResolvedValue(otherRequests);
    const { queryClient, wrapper } = makeWrapper();

    const a = renderHook(() => useAllocationRequests({ read: readerA, key: 'party-1' }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    const b = renderHook(() => useAllocationRequests({ read: readerB, key: 'party-2' }), { wrapper });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    expect(readerA).toHaveBeenCalledTimes(1);
    expect(readerB).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(partyLayerKeys.allocationRequests({ key: 'party-1' }))).toEqual(requests);
    expect(queryClient.getQueryData(partyLayerKeys.allocationRequests({ key: 'party-2' }))).toEqual(otherRequests);
  });

  it('respects passthrough query options (enabled:false does not fetch)', async () => {
    const reader = vi.fn().mockResolvedValue(requests);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useAllocationRequests({ read: reader, query: { enabled: false } }),
      { wrapper },
    );
    expect(reader).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.requests).toBeUndefined();
  });
});
