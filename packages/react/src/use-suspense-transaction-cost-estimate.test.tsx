// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toTrafficCost, type CostEstimation } from '@partylayer/core';

import { useSuspenseTransactionCostEstimate } from './use-suspense-transaction-cost-estimate';
import { partyLayerKeys } from './query-keys';

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};

/**
 * Reads the suspense hook. Accessing `costEstimate.totalTrafficCostEstimation`
 * would throw if data were undefined, proving it is defined inside the boundary.
 * `null` renders as the literal "null" marker (a valid, resolved value).
 */
function Probe({
  estimate: fetcher,
  input,
}: {
  estimate: (signal?: AbortSignal) => Promise<CostEstimation | null>;
  input?: unknown;
}) {
  const { costEstimate } = useSuspenseTransactionCostEstimate({ estimate: fetcher, input });
  return (
    <div data-testid="total">
      {costEstimate === null ? 'null' : costEstimate.totalTrafficCostEstimation}
    </div>
  );
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

describe('useSuspenseTransactionCostEstimate (v2, TanStack suspense query)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suspends while loading (fallback shown), then renders the estimate (never undefined)', async () => {
    let resolve: (v: CostEstimation | null) => void = () => {};
    const fetcher = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const queryClient = makeClient();

    renderInSuspense(<Probe estimate={fetcher} />, queryClient);

    // Suspends: fallback while the queryFn is pending.
    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByTestId('total')).toBeNull();

    act(() => resolve(estimate));

    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('300'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    // The fetcher receives an AbortSignal.
    expect(fetcher.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('resolves null as a valid value (estimation disabled/absent), no error boundary', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const queryClient = makeClient();

    renderInSuspense(<Probe estimate={fetcher} />, queryClient);

    // null is a resolved, successful value: renders the "null" marker, not the fallback.
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('null'));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('shares the cache entry with useTransactionCostEstimate (same queryKey, reads existing data, no fetch)', async () => {
    const fetcher = vi.fn().mockResolvedValue(toTrafficCost('0') as never); // must NOT be called
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    // Seed the cache exactly as useTransactionCostEstimate({ input: undefined }) would.
    queryClient.setQueryData(partyLayerKeys.transactionCostEstimate({ input: undefined }), estimate);

    renderInSuspense(<Probe estimate={fetcher} />, queryClient);

    // Renders immediately from the shared cache (no fallback, no fetch).
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('300'));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('folds input into the queryKey (different inputs cache independently)', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    const queryClient = makeClient();

    renderInSuspense(<Probe estimate={fetcher} input="tx-A" />, queryClient);

    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('300'));
    // Cached under the input-scoped key.
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-A' }))).toEqual(estimate);
    // A different input has no data yet (independent entry).
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-B' }))).toBeUndefined();
  });
});
