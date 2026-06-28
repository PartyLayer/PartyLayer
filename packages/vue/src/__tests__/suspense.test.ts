// @vitest-environment happy-dom
/**
 * Suspense-ready proof for the Vue query composables. Vue has no separate suspense
 * composable: useQuery exposes a `suspense()` function, and our composables spread
 * `...result`, so `suspense()` flows through. This mounts a component with an
 * `async setup()` that awaits `suspense()`, wrapped in Vue's `<Suspense>`, and proves
 * the fallback shows while pending and the resolved content shows after the query
 * resolves. Also asserts the query composables expose `suspense()` and the mutation
 * (useChoice) does not.
 */
import { describe, it, expect } from 'vitest';
import { defineComponent, h, Suspense } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { toTrafficCost, type CostEstimation } from '@partylayer/core';
import { useTransactionCostEstimate } from '../use-transaction-cost';
import { useDamlContract } from '../use-daml-contract';
import { useChoice } from '../use-choice';

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};

function mountInSuspense(child: ReturnType<typeof defineComponent>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Root = defineComponent({
    setup() {
      return () =>
        h(Suspense, null, {
          default: () => h(child),
          fallback: () => h('div', { class: 'fallback' }, 'loading'),
        });
    },
  });
  return mount(Root, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
}

describe('Vue query composables are Suspense-ready (await suspense() in async setup)', () => {
  it('useTransactionCostEstimate: shows the fallback while pending, then the resolved content', async () => {
    let resolveEstimate!: (v: CostEstimation | null) => void;
    const estimateFetcher = () => new Promise<CostEstimation | null>((r) => { resolveEstimate = r; });

    const Child = defineComponent({
      async setup() {
        const { suspense, costEstimate } = useTransactionCostEstimate({ estimate: estimateFetcher });
        await suspense(); // suspends this component until the query first resolves
        return () => h('div', { class: 'resolved' }, String(costEstimate.value?.totalTrafficCostEstimation));
      },
    });

    const w = mountInSuspense(Child);
    // async setup is pending -> Suspense shows the fallback, not the resolved content
    expect(w.find('.fallback').exists()).toBe(true);
    expect(w.find('.resolved').exists()).toBe(false);

    // resolve the query -> suspense() resolves -> the child renders its resolved content
    resolveEstimate(estimate);
    await flushPromises();

    expect(w.find('.fallback').exists()).toBe(false);
    expect(w.find('.resolved').exists()).toBe(true);
    expect(w.find('.resolved').text()).toBe('300');
  });

  it('useDamlContract: suspense() resolves the contract inside the boundary', async () => {
    const Child = defineComponent({
      async setup() {
        const { suspense, contract } = useDamlContract<{ id: string }>({ read: async () => ({ id: 'c1' }) });
        await suspense();
        return () => h('div', { class: 'resolved' }, contract.value?.id ?? 'none');
      },
    });
    const w = mountInSuspense(Child);
    await flushPromises();
    expect(w.find('.resolved').text()).toBe('c1');
  });

  it('the query composables expose suspense(); useChoice (a mutation) does not', () => {
    const queryClient = new QueryClient();
    let cost!: ReturnType<typeof useTransactionCostEstimate>;
    let daml!: ReturnType<typeof useDamlContract>;
    let choice!: ReturnType<typeof useChoice>;
    const Probe = defineComponent({
      setup() {
        cost = useTransactionCostEstimate({ estimate: async () => null });
        daml = useDamlContract({ read: async () => null });
        choice = useChoice({ exercise: async () => ({}) });
        return () => h('div');
      },
    });
    mount(Probe, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });

    expect(typeof cost.suspense).toBe('function');
    expect(typeof daml.suspense).toBe('function');
    // mutations do not suspend
    expect('suspense' in choice).toBe(false);
  });
});
