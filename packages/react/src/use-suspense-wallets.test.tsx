// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the client accessor so the hook gets a controllable mock client
// (the QueryClient is still real, via QueryClientProvider).
const mockListWallets = vi.fn();
vi.mock('./hooks', () => ({
  usePartyLayer: () => ({ listWallets: mockListWallets }),
}));

import { useSuspenseWallets } from './use-suspense-wallets';
import { partyLayerKeys } from './query-keys';

const wallets = [
  { walletId: 'console', name: 'Console Wallet' },
  { walletId: 'loop', name: '5N Loop' },
] as never[];

/** Reads the suspense hook; `wallets.map` would throw if data were undefined. */
function Probe({ filter }: { filter?: Record<string, unknown> }) {
  const { wallets: list } = useSuspenseWallets({ filter });
  return <div data-testid="list">{list.map((w: { walletId: string }) => w.walletId).join(',')}</div>;
}

function renderInSuspense(ui: React.ReactNode, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

describe('useSuspenseWallets (v2, TanStack suspense query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suspends while loading (fallback shown), then renders wallets (never undefined)', async () => {
    let resolveList: (w: unknown) => void = () => {};
    mockListWallets.mockReturnValue(new Promise((res) => { resolveList = res; }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderInSuspense(<Probe />, queryClient);

    // Suspends → fallback while the queryFn is pending.
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByTestId('list')).toBeNull();

    act(() => resolveList(wallets));

    // Resolves → renders with the populated (defined) wallet list.
    await waitFor(() => expect(screen.getByTestId('list').textContent).toBe('console,loop'));
    expect(mockListWallets).toHaveBeenCalledTimes(1);
  });

  it('filter flows into BOTH client.listWallets AND the queryKey', async () => {
    const filter = { includeExperimental: true };
    mockListWallets.mockResolvedValue(wallets);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderInSuspense(<Probe filter={filter} />, queryClient);

    await waitFor(() => expect(screen.getByTestId('list').textContent).toBe('console,loop'));
    // (a) forwarded to listWallets
    expect(mockListWallets).toHaveBeenCalledWith(filter);
    // (b) folded into the queryKey: data cached under partyLayerKeys.wallets({ filter })
    expect(queryClient.getQueryData(partyLayerKeys.wallets({ filter }))).toEqual(wallets);
  });

  it('shares the cache entry with useWallets (same queryKey → reads existing data, no refetch)', async () => {
    mockListWallets.mockResolvedValue([]); // must NOT be called — data is already cached & fresh
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    // Seed the cache exactly as useWallets() (filter undefined) would.
    queryClient.setQueryData(partyLayerKeys.wallets({ filter: undefined }), wallets);

    renderInSuspense(<Probe />, queryClient);

    // Renders immediately from the shared cache (no fallback, no fetch).
    await waitFor(() => expect(screen.getByTestId('list').textContent).toBe('console,loop'));
    expect(mockListWallets).not.toHaveBeenCalled();
  });
});
