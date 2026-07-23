/**
 * Cache invalidation helpers.
 *
 * The CIP-0056 read hooks namespace the consumer's `key` under their own key
 * factory, so the real TanStack queryKey is `partyLayerKeys.tokenHoldings({ key })`,
 * NOT the raw `key`. Invalidation therefore goes through the exported
 * `partyLayerKeys` factories (an empty-args call prefix-matches every party's
 * entry), as the hooks' `key` JSDoc and the `partyLayerKeys` doc now spell out.
 */
import type { QueryClient } from '@tanstack/react-query';
import { partyLayerKeys } from '@partylayer/react/query';

/** Refresh every party's holdings, instructions, and the generic reads (supply, refs). */
export function invalidateHoldingsAndReads(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.transferInstructions() });
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.damlContract() });
}

/** Refresh the allocations list. */
export function invalidateAllocations(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenAllocations() });
}
