// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the client accessor so the hook gets a controllable mock client
// (the QueryClient is still real, via QueryClientProvider).
const mockListWallets = vi.fn();
vi.mock('./hooks', () => ({
  usePartyLayer: () => ({ listWallets: mockListWallets }),
}));

import { useWallets } from './use-wallets';
import { partyLayerKeys } from './query-keys';

const wallets = [
  { walletId: 'console', name: 'Console Wallet' },
  { walletId: 'loop', name: '5N Loop' },
] as never[];

/** Fresh QueryClient per call; retries off so error/loading tests are deterministic. */
function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useWallets (v2, TanStack query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the TanStack query shape + wagmi alias (wallets === data)', async () => {
    mockListWallets.mockResolvedValue(wallets);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWallets(), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    expect('data' in result.current).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.wallets).toEqual(wallets); // alias === data
    expect(result.current.data).toEqual(wallets);
  });

  it('query calls client.listWallets and surfaces data as wallets', async () => {
    mockListWallets.mockResolvedValue(wallets);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWallets(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListWallets).toHaveBeenCalledTimes(1);
    expect(result.current.wallets).toEqual(wallets);
  });

  it('isLoading/isPending toggles true while loading, then false', async () => {
    let resolveList: (w: unknown) => void = () => {};
    mockListWallets.mockReturnValue(new Promise((res) => { resolveList = res; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWallets(), { wrapper });

    expect(result.current.isLoading).toBe(true); // initial load
    expect(result.current.isPending).toBe(true);
    act(() => resolveList(wallets));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('surfaces an error via isError/error (does not silently swallow)', async () => {
    const boom = new Error('listWallets failed');
    mockListWallets.mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWallets(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.wallets).toBeUndefined();
  });

  it('refetch re-calls client.listWallets', async () => {
    mockListWallets.mockResolvedValue(wallets);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWallets(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockListWallets).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockListWallets).toHaveBeenCalledTimes(2);
  });

  it('filter flows into BOTH client.listWallets AND the queryKey', async () => {
    const filter = { includeExperimental: true };
    mockListWallets.mockResolvedValue(wallets);
    const { queryClient, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWallets({ filter }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // (a) forwarded to listWallets
    expect(mockListWallets).toHaveBeenCalledWith(filter);
    // (b) folded into the queryKey: data is cached under partyLayerKeys.wallets({ filter })
    expect(queryClient.getQueryData(partyLayerKeys.wallets({ filter }))).toEqual(wallets);
    // a different filter is a DIFFERENT cache entry (proves filter is part of the key)
    expect(queryClient.getQueryData(partyLayerKeys.wallets({ filter: { includeExperimental: false } }))).toBeUndefined();
  });
});
