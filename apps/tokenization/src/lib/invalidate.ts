/**
 * Cache invalidation helpers.
 *
 * FINDING (important): the CIP-0056 read hooks fold the consumer's `key` INTO their
 * own query key factory, so the real TanStack queryKey is
 * `partyLayerKeys.tokenHoldings({ key })` = `['partylayer','tokenHoldings',{ key }]`,
 * NOT the raw `key` value the consumer passed. A consumer who wants to invalidate
 * must therefore import `partyLayerKeys` from `@partylayer/react/query` and match on
 * the factory (an empty-args call prefix-matches every party's entry), rather than
 * on the `key` they passed. That is subtle: the `key` prop reads like it IS the
 * cache key, but it is nested one level down.
 */
import type { QueryClient } from '@tanstack/react-query';
import { partyLayerKeys } from '@partylayer/react/query';

/** Refresh every party's holdings plus the generic reads (incoming, supply, refs). */
export function invalidateHoldingsAndReads(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.damlContract() });
}

/** Refresh the allocations list. */
export function invalidateAllocations(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenAllocations() });
}
