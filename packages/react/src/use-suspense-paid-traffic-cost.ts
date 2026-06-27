'use client';

/**
 * @partylayer/react v2: useSuspensePaidTrafficCost (TanStack suspense query).
 *
 * The Suspense sibling of `usePaidTrafficCost`, for declarative loading
 * boundaries. It is identical to `usePaidTrafficCost` except it uses
 * `useSuspenseQuery` instead of `useQuery`: loading and error are delegated to the
 * nearest React `<Suspense>` (and error boundary), so `data`/`paidTrafficCost` is
 * NEVER `undefined` inside the rendered subtree.
 *
 * MODEL 2 preserved: PartyLayer does NOT own ledger transport. Like
 * `usePaidTrafficCost`, this hook does **not** touch the PartyLayer client, does
 * not call `usePartyLayer`, and does not reach any ledger/validator itself. The
 * dApp supplies its OWN fetcher (`fetch`), and this hook only wraps it in
 * `useSuspenseQuery` and types it with core's `PaidTrafficCost`.
 *
 * It uses the SAME `queryKey` (`partyLayerKeys.paidTrafficCost({ input })`) and
 * SAME `queryFn` shape (`({ signal }) => fetch(signal)`) as `usePaidTrafficCost`,
 * so the suspense and non-suspense versions SHARE a single cache entry: rendering
 * both, or switching between them, reuses the same data.
 *
 * Null nuance: `paidTrafficCost` is OPTIONAL (e.g. absent for updates initiated by
 * another participant, or processed before the node served traffic cost on the
 * Ledger API), so the fetcher returns `PaidTrafficCost | null`. Under Suspense,
 * `data` is never `undefined` (the promise has resolved), but it CAN still be
 * `null`: `null` is a resolved, successful value, not a loading state. So
 * `paidTrafficCost` is `PaidTrafficCost | null` inside the boundary.
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
import type { PaidTrafficCost } from '@partylayer/core';
import { partyLayerKeys } from './query-keys';

export interface UseSuspensePaidTrafficCostParameters {
  /**
   * The dApp's fetcher. Reads the completion's `paidTrafficCost` from the dApp's
   * own validator (authoritative for command-driven flows) and resolves it, or
   * `null` when the cost is absent. Receives the query's `AbortSignal` so the
   * dApp can cancel in-flight requests.
   */
  fetch: (signal?: AbortSignal) => Promise<PaidTrafficCost | null>;
  /**
   * Opaque identifier for the transaction whose actual cost this is. Folded into
   * the queryKey so different transactions cache independently. Does not need to
   * be forwarded to `fetch` (the dApp's fetcher already closes over its tx).
   */
  input?: unknown;
  /**
   * Pass-through TanStack `useSuspenseQuery` options (e.g. `staleTime`,
   * `refetchInterval`). `queryKey` and `queryFn` are managed by the hook and
   * cannot be overridden. (`enabled` does not apply to suspense queries.)
   */
  query?: Omit<UseSuspenseQueryOptions<PaidTrafficCost | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseSuspensePaidTrafficCostReturnType = UseSuspenseQueryResult<
  PaidTrafficCost | null,
  Error
> & {
  /**
   * The actual paid traffic cost (alias of `data`). Never `undefined` under
   * Suspense; `null` when absent (a resolved, successful value).
   */
  paidTrafficCost: PaidTrafficCost | null;
};

export function useSuspensePaidTrafficCost(
  parameters: UseSuspensePaidTrafficCostParameters,
): UseSuspensePaidTrafficCostReturnType {
  const { fetch, input, query } = parameters;

  const result = useSuspenseQuery<PaidTrafficCost | null, Error>({
    ...query,
    queryKey: partyLayerKeys.paidTrafficCost({ input }),
    // Same key + same fetcher shape as usePaidTrafficCost: they share one cache
    // entry. PartyLayer does not own ledger transport (Model 2).
    queryFn: ({ signal }) => fetch(signal),
  });

  return {
    ...result,
    paidTrafficCost: result.data,
  };
}
