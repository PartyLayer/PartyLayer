// @vitest-environment happy-dom
/**
 * Vue cost composable tests: the Vue mirror of React's cost hook tests, using the
 * vue-query test harness (a QueryClient via VueQueryPlugin, the composable called
 * in a component setup()). Covers: resolves a CostEstimation/PaidTrafficCost (the
 * ComputedRef alias reflects data), null-is-valid, queryKey scopes the cache by
 * input, and CRITICALLY the Vue reactivity proof: a reactive input change refetches
 * with the new key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { toTrafficCost, type CostEstimation, type PaidTrafficCost } from '@partylayer/core';
import { useTransactionCostEstimate, usePaidTrafficCost } from '../use-transaction-cost';
import { partyLayerKeys } from '../query-keys';

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};
const paid: PaidTrafficCost = toTrafficCost('500');

/** Mount a component that runs `setup`, with a fresh QueryClient via VueQueryPlugin. */
function mountWithQuery(setup: () => unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Comp = defineComponent({ setup });
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTransactionCostEstimate (Vue, vue-query, Model 2)', () => {
  it('resolves a CostEstimation; costEstimate ComputedRef reflects data', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    let r!: ReturnType<typeof useTransactionCostEstimate>;
    mountWithQuery(() => {
      r = useTransactionCostEstimate({ estimate: fetcher });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isSuccess.value).toBe(true);
    expect(r.costEstimate.value).toEqual(estimate); // ComputedRef alias of data
    expect(r.data.value).toEqual(estimate);
    // queryFn received an AbortSignal (vue-query context, like React)
    expect(fetcher.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('resolves null as a valid value (estimation absent), not an error', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    let r!: ReturnType<typeof useTransactionCostEstimate>;
    mountWithQuery(() => {
      r = useTransactionCostEstimate({ estimate: fetcher });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isSuccess.value).toBe(true);
    expect(r.costEstimate.value).toBeNull();
    expect(r.isError.value).toBe(false);
  });

  it('folds input into the queryKey (different inputs cache independently)', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    let queryClient!: QueryClient;
    ({ queryClient } = mountWithQuery(() => {
      useTransactionCostEstimate({ estimate: fetcher, input: 'tx-A' });
      return () => h('div');
    }));
    await flushPromises();
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-A' }))).toEqual(estimate);
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-B' }))).toBeUndefined();
  });

  it('REACTIVITY: a reactive input change refetches with the new key', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    const input = ref('tx-1');
    let queryClient!: QueryClient;
    ({ queryClient } = mountWithQuery(() => {
      useTransactionCostEstimate({ estimate: fetcher, input }); // reactive ref input
      return () => h('div');
    }));
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-1' }))).toEqual(estimate);

    // change the reactive input -> new queryKey -> refetch
    input.value = 'tx-2';
    await nextTick();
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2); // refetched for the new key
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-2' }))).toEqual(estimate);
  });
});

describe('usePaidTrafficCost (Vue, vue-query, Model 2)', () => {
  it('resolves a PaidTrafficCost; paidTrafficCost ComputedRef reflects data', async () => {
    const fetcher = vi.fn().mockResolvedValue(paid);
    let r!: ReturnType<typeof usePaidTrafficCost>;
    mountWithQuery(() => {
      r = usePaidTrafficCost({ fetch: fetcher });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isSuccess.value).toBe(true);
    expect(r.paidTrafficCost.value).toBe(paid);
    expect(fetcher.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('resolves null as a valid value (cost absent), not an error', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    let r!: ReturnType<typeof usePaidTrafficCost>;
    mountWithQuery(() => {
      r = usePaidTrafficCost({ fetch: fetcher });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isSuccess.value).toBe(true);
    expect(r.paidTrafficCost.value).toBeNull();
    expect(r.isError.value).toBe(false);
  });

  it('REACTIVITY: a reactive input change refetches with the new key', async () => {
    const fetcher = vi.fn().mockResolvedValue(paid);
    const input = ref('p-1');
    let queryClient!: QueryClient;
    ({ queryClient } = mountWithQuery(() => {
      usePaidTrafficCost({ fetch: fetcher, input });
      return () => h('div');
    }));
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);
    input.value = 'p-2';
    await nextTick();
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(partyLayerKeys.paidTrafficCost({ input: 'p-2' }))).toBe(paid);
  });
});
