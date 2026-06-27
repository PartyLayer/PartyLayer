'use client';

/**
 * @partylayer/react v2: useSuspenseTransactionCostEstimate (TanStack suspense query).
 *
 * The Suspense sibling of `useTransactionCostEstimate`, for declarative loading
 * boundaries. It is identical to `useTransactionCostEstimate` except it uses
 * `useSuspenseQuery` instead of `useQuery`: loading and error are delegated to the
 * nearest React `<Suspense>` (and error boundary), so `data`/`costEstimate` is
 * NEVER `undefined` inside the rendered subtree.
 *
 * MODEL 2 preserved: PartyLayer does NOT own ledger transport. Like
 * `useTransactionCostEstimate`, this hook does **not** touch the PartyLayer client,
 * does not call `usePartyLayer`, and does not reach any ledger/validator itself.
 * The dApp supplies its OWN cost-fetcher (`estimate`), and this hook only wraps it
 * in `useSuspenseQuery` and types it with core's `CostEstimation`.
 *
 * It uses the SAME `queryKey` (`partyLayerKeys.transactionCostEstimate({ input })`)
 * and SAME `queryFn` shape (`({ signal }) => estimate(signal)`) as
 * `useTransactionCostEstimate`, so the suspense and non-suspense versions SHARE a
 * single cache entry: rendering both, or switching between them, reuses the same
 * data.
 *
 * Null nuance: `costEstimation` is OPTIONAL on the prepare response (it may be
 * disabled or absent), so the fetcher returns `CostEstimation | null`. Under
 * Suspense, `data` is never `undefined` (the promise has resolved), but it CAN
 * still be `null`: `null` is a resolved, successful value, not a loading state.
 * So `costEstimate` is `CostEstimation | null` inside the boundary.
 *
 * Note (TanStack Query v5): suspense is its own hook (`useSuspenseQuery`), not the
 * removed v4 `suspense: true` option, and there is no `enabled` option: a suspense
 * query always runs.
 */
import {
  useSuspenseQuery,
  type UseSuspenseQueryOptions,
  type UseSuspenseQueryResult,
} from '@tanstack/react-query';
import type { CostEstimation } from '@partylayer/core';
import { partyLayerKeys } from './query-keys';

export interface UseSuspenseTransactionCostEstimateParameters {
  /**
   * The dApp's cost-fetcher. Calls the dApp's own validator
   * (`/v2/interactive-submission/prepare`) and resolves the estimate, or `null`
   * when cost estimation is disabled/absent. Receives the query's `AbortSignal`
   * so the dApp can cancel in-flight requests.
   */
  estimate: (signal?: AbortSignal) => Promise<CostEstimation | null>;
  /**
   * Opaque identifier for the transaction being estimated. Folded into the
   * queryKey so different transactions cache independently. Does not need to be
   * forwarded to `estimate` (the dApp's fetcher already closes over its tx).
   */
  input?: unknown;
  /**
   * Pass-through TanStack `useSuspenseQuery` options (e.g. `staleTime`,
   * `refetchInterval`). `queryKey` and `queryFn` are managed by the hook and
   * cannot be overridden. (`enabled` does not apply to suspense queries.)
   */
  query?: Omit<UseSuspenseQueryOptions<CostEstimation | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseSuspenseTransactionCostEstimateReturnType = UseSuspenseQueryResult<
  CostEstimation | null,
  Error
> & {
  /**
   * The cost estimate (alias of `data`). Never `undefined` under Suspense; `null`
   * when estimation is disabled/absent (a resolved, successful value).
   */
  costEstimate: CostEstimation | null;
};

export function useSuspenseTransactionCostEstimate(
  parameters: UseSuspenseTransactionCostEstimateParameters,
): UseSuspenseTransactionCostEstimateReturnType {
  const { estimate, input, query } = parameters;

  const result = useSuspenseQuery<CostEstimation | null, Error>({
    ...query,
    queryKey: partyLayerKeys.transactionCostEstimate({ input }),
    // Same key + same fetcher shape as useTransactionCostEstimate: they share one
    // cache entry. PartyLayer does not own ledger transport (Model 2).
    queryFn: ({ signal }) => estimate(signal),
  });

  return {
    ...result,
    costEstimate: result.data,
  };
}
