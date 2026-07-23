/**
 * Thin app helpers over the canonical matching comparator now owned by
 * `@partylayer/react`. The DvP finding that motivated the package helper is
 * resolved; this file only adapts `allocationMatchesRequestLeg` to the array-search
 * conveniences the venue view uses (find the allocation for a leg, list matched leg
 * ids). No app-level amount comparator lives here anymore.
 */
import { allocationMatchesRequestLeg } from '@partylayer/react/query';
import type { TokenAllocationRef, TokenAllocationRequest } from '@partylayer/react/query';

/** The allocation ref that satisfies a request's leg, if any. */
export function allocationForLeg(
  request: TokenAllocationRequest,
  legId: string,
  allocations: TokenAllocationRef[],
): TokenAllocationRef | undefined {
  return allocations.find((a) => allocationMatchesRequestLeg(a.allocation, request, legId));
}

/** The leg ids of a request that are satisfied by the given allocations. */
export function matchedLegIds(
  request: TokenAllocationRequest,
  allocations: TokenAllocationRef[],
): string[] {
  return Object.keys(request.transferLegs).filter(
    (legId) => !!allocationForLeg(request, legId, allocations),
  );
}
