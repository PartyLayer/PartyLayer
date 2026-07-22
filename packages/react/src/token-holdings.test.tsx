// @vitest-environment jsdom
/**
 * useTokenHoldings tests: a CIP-0056 typed specialization of useDamlContract.
 * Mirrors the useDamlContract test. Covers: the hook wraps the dApp's read
 * fetcher and exposes the TanStack shape plus a `holdings` alias; read resolving
 * a TokenHolding[] populates holdings; read resolving null yields holdings=null
 * (successful, not an error); read rejecting yields isError; the queryKey folds in
 * the opaque key so different keys cache independently; and passthrough query
 * options (e.g. enabled:false) are respected. Model 2: rendered with only a
 * QueryClientProvider (no PartyLayerProvider), proving no client access.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useTokenHoldings, type TokenHolding } from './token-holdings';
import { partyLayerKeys } from './query-keys';

const holdings: TokenHolding[] = [
  {
    owner: 'party::owner-1',
    instrumentId: { admin: 'party::registry-admin', id: 'USDC' },
    amount: '42.5',
    meta: { source: 'faucet' },
  },
  {
    owner: 'party::owner-1',
    instrumentId: { admin: 'party::registry-admin', id: 'CC' },
    amount: '1000',
    lock: { holders: ['party::escrow'], expiresAt: '2026-08-01T00:00:00Z' },
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

describe('useTokenHoldings (CIP-0056 typed read, dApp-supplied read fetcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps the read fetcher and exposes the TanStack shape + alias (holdings === data) on success', async () => {
    const reader = vi.fn().mockResolvedValue(holdings);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenHoldings({ read: reader }), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    expect('data' in result.current).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.holdings).toEqual(holdings); // alias === data
    expect(result.current.data).toEqual(holdings);
    // Typed shape flows through: instrumentId + decimal-as-string amount.
    expect(result.current.holdings?.[0].instrumentId.id).toBe('USDC');
    expect(result.current.holdings?.[0].amount).toBe('42.5');
    expect(result.current.holdings?.[1].lock?.holders).toEqual(['party::escrow']);
  });

  it('queryFn calls the provided read fetcher with the AbortSignal (no PartyLayer client involved)', async () => {
    const reader = vi.fn().mockResolvedValue(holdings);
    const { wrapper } = makeWrapper();
    // Renders with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result } = renderHook(() => useTokenHoldings({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('null holdings (none yet/absent): holdings === null, isSuccess true (not an error)', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenHoldings({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.holdings).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('empty array is a valid successful result distinct from null', async () => {
    const reader = vi.fn().mockResolvedValue([]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenHoldings({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.holdings).toEqual([]);
    expect(result.current.holdings).not.toBeNull();
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('acs query failed');
    const reader = vi.fn().mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenHoldings({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.holdings).toBeUndefined();
  });

  it('isPending toggles true while pending, then false', async () => {
    let resolve: (v: TokenHolding[] | null) => void = () => {};
    const reader = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTokenHoldings({ read: reader }), { wrapper });

    expect(result.current.isPending).toBe(true);
    act(() => resolve(holdings));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('opaque key scopes the cache (different keys cache independently)', async () => {
    const readerA = vi.fn().mockResolvedValue(holdings);
    const otherHoldings: TokenHolding[] = [
      { owner: 'party::owner-2', instrumentId: { admin: 'party::registry-admin', id: 'CC' }, amount: '7' },
    ];
    const readerB = vi.fn().mockResolvedValue(otherHoldings);
    const { queryClient, wrapper } = makeWrapper();

    const a = renderHook(() => useTokenHoldings({ read: readerA, key: 'owner-1' }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    const b = renderHook(() => useTokenHoldings({ read: readerB, key: 'owner-2' }), { wrapper });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    // both fetchers ran (no cache collision between the two keys)
    expect(readerA).toHaveBeenCalledTimes(1);
    expect(readerB).toHaveBeenCalledTimes(1);
    // each cached under its own key-scoped queryKey
    expect(queryClient.getQueryData(partyLayerKeys.tokenHoldings({ key: 'owner-1' }))).toEqual(holdings);
    expect(queryClient.getQueryData(partyLayerKeys.tokenHoldings({ key: 'owner-2' }))).toEqual(otherHoldings);
  });

  it('respects passthrough query options (enabled:false does not fetch)', async () => {
    const reader = vi.fn().mockResolvedValue(holdings);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useTokenHoldings({ read: reader, query: { enabled: false } }),
      { wrapper },
    );
    // enabled:false: the query never runs, so the fetcher is not called.
    expect(reader).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.holdings).toBeUndefined();
  });
});
