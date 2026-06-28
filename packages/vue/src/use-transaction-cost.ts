/**
 * Vue cost composables (CIP-0104 cost visibility): the Vue mirror of React's
 * useTransactionCostEstimate / usePaidTrafficCost, built on vue-query.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like the React cost hooks,
 * these composables do not reach any ledger/validator themselves. The dApp supplies
 * its OWN fetcher (typically a call to its validator's prepare/completion), and the
 * composable only wraps that fetcher in vue-query and types it with core's cost
 * types. That keeps it ledgerApi-independent, wallet-agnostic, and
 * generic-bridge-compatible: a thin, standard UX/cache layer over a field the dApp
 * already has.
 *
 * VUE IDIOM (differences from React, which returns plain values):
 *  - The aliases (`costEstimate` / `paidTrafficCost`) are `ComputedRef`s over the
 *    query result's `data` ref, matching how the other Vue composables expose
 *    `ComputedRef`s. Read them with `.value` (or auto-unwrap in templates).
 *  - `input` (the cache scope) is a `MaybeRefOrGetter`, so a consumer can pass a
 *    `ref`/`computed`/getter. The `queryKey` is a `computed` over `toValue(input)`,
 *    so when `input` changes the key changes and the query refetches. This is the
 *    main vue-query pitfall (reactivity loss from reading a reactive value too
 *    early); reading it inside the computed via `toValue` preserves reactivity.
 *
 * `null` is a VALID resolved value (cost estimation disabled/absent, or paid cost
 * not yet available), not an error.
 *
 * The QueryClient is supplied by the CONSUMER via `VueQueryPlugin`
 * (`app.use(VueQueryPlugin)`), the Vue analog of React's `QueryClientProvider`.
 */
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { CostEstimation, PaidTrafficCost } from '@partylayer/core';
import { partyLayerKeys } from './query-keys';

export interface UseTransactionCostEstimateParameters {
  /**
   * The dApp's cost-fetcher. Calls the dApp's own validator
   * (`/v2/interactive-submission/prepare`) and resolves the estimate, or `null`
   * when cost estimation is disabled/absent. Receives the query's `AbortSignal`
   * so the dApp can cancel in-flight requests.
   */
  estimate: (signal?: AbortSignal) => Promise<CostEstimation | null>;
  /**
   * Opaque identifier for the transaction being estimated, folded into the
   * queryKey so different transactions cache independently. May be reactive (a
   * `ref`/`computed`/getter): when it changes, the query refetches.
   */
  input?: MaybeRefOrGetter<unknown>;
  /**
   * Pass-through vue-query `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the composable and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<CostEstimation | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseTransactionCostEstimateReturnType = UseQueryReturnType<CostEstimation | null, Error> & {
  /**
   * The cost estimate (a `ComputedRef` alias of `data`). `undefined` until loaded;
   * `null` when estimation is disabled/absent (a successful result, not an error).
   */
  costEstimate: ComputedRef<CostEstimation | null | undefined>;
};

export function useTransactionCostEstimate(
  parameters: UseTransactionCostEstimateParameters,
): UseTransactionCostEstimateReturnType {
  const { estimate, input, query } = parameters;

  const result = useQuery<CostEstimation | null, Error>({
    ...query,
    // Computed key tracks `input`'s reactivity: input changes -> key changes ->
    // refetch. PartyLayer does not own ledger transport (Model 2).
    queryKey: computed(() => partyLayerKeys.transactionCostEstimate({ input: toValue(input) })),
    queryFn: ({ signal }) => estimate(signal),
  });

  return {
    ...result,
    costEstimate: computed(() => result.data.value),
  };
}

export interface UsePaidTrafficCostParameters {
  /**
   * The dApp's fetcher. Reads the completion's `paidTrafficCost` from the dApp's
   * own validator (authoritative for command-driven flows) and resolves it, or
   * `null` when the cost is absent. Receives the query's `AbortSignal` so the dApp
   * can cancel in-flight requests.
   */
  fetch: (signal?: AbortSignal) => Promise<PaidTrafficCost | null>;
  /**
   * Opaque identifier for the transaction whose actual cost this is, folded into
   * the queryKey so different transactions cache independently. May be reactive (a
   * `ref`/`computed`/getter): when it changes, the query refetches.
   */
  input?: MaybeRefOrGetter<unknown>;
  /**
   * Pass-through vue-query `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the composable and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<PaidTrafficCost | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UsePaidTrafficCostReturnType = UseQueryReturnType<PaidTrafficCost | null, Error> & {
  /**
   * The actual paid traffic cost (a `ComputedRef` alias of `data`). `undefined`
   * until loaded; `null` when absent (a successful result, not an error).
   */
  paidTrafficCost: ComputedRef<PaidTrafficCost | null | undefined>;
};

export function usePaidTrafficCost(
  parameters: UsePaidTrafficCostParameters,
): UsePaidTrafficCostReturnType {
  const { fetch, input, query } = parameters;

  const result = useQuery<PaidTrafficCost | null, Error>({
    ...query,
    queryKey: computed(() => partyLayerKeys.paidTrafficCost({ input: toValue(input) })),
    queryFn: ({ signal }) => fetch(signal),
  });

  return {
    ...result,
    paidTrafficCost: computed(() => result.data.value),
  };
}
