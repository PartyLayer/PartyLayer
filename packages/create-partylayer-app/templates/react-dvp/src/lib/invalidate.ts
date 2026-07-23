/**
 * Cache invalidation helper.
 *
 * The CIP-0056 read hooks namespace the consumer's `key` under their own key
 * factory, so the real TanStack queryKey is `partyLayerKeys.tokenHoldings({ key })`,
 * NOT the raw `key`. Invalidation therefore goes through the exported
 * `partyLayerKeys` factories (an empty-args call prefix-matches every party's
 * entry), as the hooks' `key` JSDoc and the `partyLayerKeys` doc spell out.
 */
import type { QueryClient } from '@tanstack/react-query';
import { partyLayerKeys } from '@partylayer/react/query';

/** Refresh every party's trades, allocations, and holdings after a write. */
export function invalidateAll(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.allocationRequests() });
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenAllocations() });
  queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });
}
