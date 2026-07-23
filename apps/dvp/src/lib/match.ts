/**
 * Expected-spec matching for settlement.
 *
 * FINDING candidate: matching an allocation against a request's leg (does this
 * allocation satisfy this leg of this trade?) is a spec comparison the app has to
 * write itself. The package could own a comparator over `TokenTransferLeg` /
 * `TokenAllocation` vs `TokenAllocationRequest`, since every settlement venue needs
 * exactly this. Reported in the README findings; this app-level comparator is the
 * workaround, shared by the store and the venue view.
 */
import type {
  TokenTransferLeg,
  TokenAllocationRef,
  TokenAllocationRequest,
} from '@partylayer/react/query';
import { cmpAmount } from './format';

/** Whether two transfer legs describe the same movement (sender, receiver, amount, instrument). */
export function legMatches(a: TokenTransferLeg, b: TokenTransferLeg): boolean {
  return (
    a.sender === b.sender &&
    a.receiver === b.receiver &&
    cmpAmount(a.amount, b.amount) === 0 &&
    a.instrumentId.admin === b.instrumentId.admin &&
    a.instrumentId.id === b.instrumentId.id
  );
}

/** The allocation ref that satisfies a request's leg (matched on settlement ref + leg id + spec). */
export function allocationForLeg(
  request: TokenAllocationRequest,
  legId: string,
  allocations: TokenAllocationRef[],
): TokenAllocationRef | undefined {
  const requestCid = request.settlement.settlementRef.cid;
  const leg = request.transferLegs[legId];
  if (!leg) return undefined;
  return allocations.find((a) => {
    const spec = a.allocation.allocation;
    return (
      spec.settlement.settlementRef.cid === requestCid &&
      spec.transferLegId === legId &&
      legMatches(spec.transferLeg, leg)
    );
  });
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
