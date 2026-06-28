// @vitest-environment node
/**
 * SSR + hydration proof for @partylayer/vue. Runs in the `node` environment (no
 * window/document) to mirror server rendering. Covers:
 *  1. SSR-safety: the composables + provideSessionStore render to a string on the
 *     server (no browser APIs, init deferred to the client) and show the SSR-safe
 *     DISCONNECTED state, without throwing.
 *  2. Server-side query fetching + hydration: a component using a query composable
 *     with onServerPrefetch(() => suspense()) fetches on the server (the resolved
 *     value is in the SSR HTML, no loading flash), and the prefetched data dehydrates
 *     and hydrates into a fresh client (vue-query SSR), so a Nuxt consumer's
 *     prefetch -> hydration works with our composables.
 */
import { describe, it, expect, vi } from 'vitest';
import { createSSRApp, defineComponent, h, onServerPrefetch } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { QueryClient, VueQueryPlugin, dehydrate, hydrate } from '@tanstack/vue-query';
import type { CIP0103Account, CIP0103Provider } from '@partylayer/core';
import { toTrafficCost, type CostEstimation } from '@partylayer/core';
import { provideSessionStore } from '../provide';
import { useSession, usePartyState } from '../composables';
import { useTransactionCostEstimate } from '../use-transaction-cost';
import { partyLayerKeys } from '../query-keys';

const acct = (partyId: string): CIP0103Account => ({
  primary: true,
  partyId,
  status: 'allocated' as CIP0103Account['status'],
  hint: 'h',
  publicKey: 'pk',
  namespace: 'ns',
  networkId: 'canton:da-devnet',
  signingProviderId: 'webauthn-prf',
});

function mockProvider() {
  const ls = new Map<string, Set<(...a: unknown[]) => void>>();
  const p = {
    on(e: string, l: (...a: unknown[]) => void) {
      (ls.get(e) ?? ls.set(e, new Set()).get(e)!).add(l);
      return p;
    },
    removeListener: vi.fn(() => p),
    emit(e: string, ...args: unknown[]) {
      ls.get(e)?.forEach((l) => l(...args));
    },
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method === 'status') return { connection: { isConnected: false } };
      if (method === 'listAccounts') return [acct('party::a')];
      return {};
    }),
  };
  return p;
}

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};

describe('SSR-safety (renders on the server with no browser APIs)', () => {
  it('renders the disconnected session state to a string without throwing (no window)', async () => {
    expect(typeof window).toBe('undefined'); // server-like environment

    const provider = mockProvider();
    const Child = defineComponent({
      setup() {
        const session = useSession();
        const party = usePartyState();
        return () => h('div', { id: 'app' }, `${session.status.value}|${party.party.value ?? 'none'}`);
      },
    });
    const Root = defineComponent({
      setup() {
        // Builds the session store; init() is deferred to the client (never runs here).
        provideSessionStore({ provider });
        return () => h(Child);
      },
    });

    const html = await renderToString(createSSRApp(Root));
    // SSR-safe disconnected snapshot, hydrates consistently on the client
    expect(html).toContain('disconnected');
    expect(html).toContain('none');
    // init() must NOT have run on the server (wallet is client-only)
    expect(provider.request).not.toHaveBeenCalled();
  });
});

describe('Server-side query fetching + hydration (vue-query dehydrate/hydrate)', () => {
  it('onServerPrefetch + suspense() fetches on the server and the data hydrates into a fresh client', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    const serverClient = new QueryClient();

    const Page = defineComponent({
      setup() {
        const { suspense, costEstimate } = useTransactionCostEstimate({ estimate: fetcher, input: 'tx-1' });
        // Nuxt server prefetch: fetch on the server so the HTML is already resolved.
        onServerPrefetch(async () => {
          await suspense();
        });
        return () => h('div', { id: 'total' }, String(costEstimate.value?.totalTrafficCostEstimation ?? 'pending'));
      },
    });

    const app = createSSRApp(Page);
    app.use(VueQueryPlugin, { queryClient: serverClient });
    const html = await renderToString(app);

    // (a) the server fetched and rendered the resolved value (no loading flash)
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(html).toContain('300');

    // (b) the prefetched data dehydrates...
    const dehydrated = dehydrate(serverClient);
    // ...and hydrates into a fresh client (the client side of SSR)
    const clientClient = new QueryClient();
    hydrate(clientClient, dehydrated);
    expect(clientClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-1' }))).toEqual(estimate);
  });
});
