// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toTrafficCost, type PaidTrafficCost } from '@partylayer/core';

import { useSuspensePaidTrafficCost } from './use-suspense-paid-traffic-cost';
import { partyLayerKeys } from './query-keys';

const cost: PaidTrafficCost = toTrafficCost('500');

/**
 * Reads the suspense hook. `paidTrafficCost` is never undefined inside the
 * boundary; `null` renders as the literal "null" marker (a valid, resolved value).
 */
function Probe({
  fetch: fetcher,
  input,
}: {
  fetch: (signal?: AbortSignal) => Promise<PaidTrafficCost | null>;
  input?: unknown;
}) {
  const { paidTrafficCost } = useSuspensePaidTrafficCost({ fetch: fetcher, input });
  return <div data-testid="paid">{paidTrafficCost === null ? 'null' : paidTrafficCost}</div>;
}

/** Only a QueryClientProvider plus a Suspense boundary: deliberately NO PartyLayerProvider (Model 2). */
function renderInSuspense(ui: React.ReactNode, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('useSuspensePaidTrafficCost (v2, TanStack suspense query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suspends while loading (fallback shown), then renders the paid cost (never undefined)', async () => {
    let resolve: (v: PaidTrafficCost | null) => void = () => {};
    const fetcher = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const queryClient = makeClient();

    renderInSuspense(<Probe fetch={fetcher} />, queryClient);

    // Suspends: fallback while the queryFn is pending.
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByTestId('paid')).toBeNull();

    act(() => resolve(cost));

    await waitFor(() => expect(screen.getByTestId('paid').textContent).toBe('500'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    // The fetcher receives an AbortSignal.
    expect(fetcher.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('resolves null as a valid value (cost absent), no error boundary', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const queryClient = makeClient();

    renderInSuspense(<Probe fetch={fetcher} />, queryClient);

    // null is a resolved, successful value: renders the "null" marker, not the fallback.
    await waitFor(() => expect(screen.getByTestId('paid').textContent).toBe('null'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('shares the cache entry with usePaidTrafficCost (same queryKey, reads existing data, no fetch)', async () => {
    const fetcher = vi.fn().mockResolvedValue(toTrafficCost('0')); // must NOT be called
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    // Seed the cache exactly as usePaidTrafficCost({ input: undefined }) would.
    queryClient.setQueryData(partyLayerKeys.paidTrafficCost({ input: undefined }), cost);

    renderInSuspense(<Probe fetch={fetcher} />, queryClient);

    // Renders immediately from the shared cache (no fallback, no fetch).
    await waitFor(() => expect(screen.getByTestId('paid').textContent).toBe('500'));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('folds input into the queryKey (different inputs cache independently)', async () => {
    const fetcher = vi.fn().mockResolvedValue(cost);
    const queryClient = makeClient();

    renderInSuspense(<Probe fetch={fetcher} input="tx-A" />, queryClient);

    await waitFor(() => expect(screen.getByTestId('paid').textContent).toBe('500'));
    // Cached under the input-scoped key.
    expect(queryClient.getQueryData(partyLayerKeys.paidTrafficCost({ input: 'tx-A' }))).toBe(cost);
    // A different input has no data yet (independent entry).
    expect(queryClient.getQueryData(partyLayerKeys.paidTrafficCost({ input: 'tx-B' }))).toBeUndefined();
  });
});
