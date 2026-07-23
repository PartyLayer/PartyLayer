/**
 * A tiny in-memory mutable store for the DvP demo, mirroring the official
 * token-standard trading-app semantics: a trade is an allocation request with two
 * opposite legs; each sender allocates its leg; the venue settles atomically. It
 * stands in for a validator plus a trade app so every hook exercises real loading,
 * success, error, and invalidation without a live ledger.
 *
 * Decimal amounts stay strings throughout; arithmetic goes through the two-decimal
 * helpers in `./format` (documented simplification).
 *
 * Deadlines (`allocateBefore`, `settleBefore`) are ISO 8601 Z strings compared
 * lexicographically against `now()`; that ordering is correct for same-format Z
 * timestamps and needs no date math.
 */
import type {
  TokenHoldingRef,
  TokenAllocationRef,
  TokenAllocationRequestRef,
  TokenTransferLeg,
} from '@partylayer/react/query';
import type { DemoPartyKey } from './types';
import {
  PARTIES,
  seedHoldings,
  seedRequests,
  buildTrade,
  DEFAULT_ALLOCATE_BEFORE,
  DEFAULT_SETTLE_BEFORE,
} from './fixtures';
import { addAmount, subAmount, cmpAmount } from './format';
import { legMatches } from './match';

interface StoreState {
  holdings: Record<DemoPartyKey, TokenHoldingRef[]>;
  requests: TokenAllocationRequestRef[];
  allocations: Record<DemoPartyKey, TokenAllocationRef[]>;
}

let state: StoreState = freshState();
let cidCounter = 0;

function freshState(): StoreState {
  return {
    holdings: seedHoldings(),
    requests: seedRequests(),
    allocations: { venue: [], alice: [], bob: [] },
  };
}

function nextCid(prefix: string): string {
  cidCounter += 1;
  // The 'gen' namespace keeps generated cids from colliding with the fixed seed cids.
  return prefix + '-gen' + cidCounter.toString();
}

function keyOf(partyId: string): DemoPartyKey | null {
  for (const key of Object.keys(PARTIES) as DemoPartyKey[]) {
    if (PARTIES[key].partyId === partyId) return key;
  }
  return null;
}

/** The current instant, as an ISO 8601 Z string (for deadline comparisons). */
export function now(): string {
  return new Date().toISOString();
}

/** Artificial latency so loading skeletons are visible (200 to 400 ms). */
export function latency(): Promise<void> {
  const ms = 200 + ((cidCounter * 37) % 200);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Find the allocation (across parties) that satisfies a request's leg, if any. */
function findAllocation(requestCid: string, legId: string): TokenAllocationRef | undefined {
  for (const party of Object.keys(state.allocations) as DemoPartyKey[]) {
    for (const alloc of state.allocations[party]) {
      const spec = alloc.allocation.allocation;
      if (spec.settlement.settlementRef.cid === requestCid && spec.transferLegId === legId) {
        return alloc;
      }
    }
  }
  return undefined;
}

function requestByCid(requestCid: string): TokenAllocationRequestRef {
  const req = state.requests.find((r) => r.cid === requestCid);
  if (!req) throw new Error('Trade not found: ' + requestCid);
  return req;
}

/** Consume `amount` of an instrument from a party's chosen unlocked holdings (change back). */
function debit(party: DemoPartyKey, admin: string, id: string, amount: string, inputCids: string[]): void {
  const chosen = state.holdings[party].filter(
    (ref) =>
      inputCids.includes(ref.cid) &&
      !ref.holding.lock &&
      ref.holding.instrumentId.admin === admin &&
      ref.holding.instrumentId.id === id,
  );
  const available = chosen.reduce((sum, ref) => addAmount(sum, ref.holding.amount), '0.00');
  if (cmpAmount(available, amount) < 0) {
    throw new Error(
      'Insufficient selected holdings: need ' + amount + ' but only ' + available + ' is selected.',
    );
  }
  let remaining = amount;
  const spent = new Set<string>();
  for (const ref of chosen) {
    if (cmpAmount(remaining, '0.00') <= 0) break;
    spent.add(ref.cid);
    if (cmpAmount(ref.holding.amount, remaining) >= 0) {
      const change = subAmount(ref.holding.amount, remaining);
      remaining = '0.00';
      if (cmpAmount(change, '0.00') > 0) {
        state.holdings[party].push({
          cid: nextCid('h-' + party),
          holding: { ...ref.holding, amount: change, lock: undefined },
        });
      }
    } else {
      remaining = subAmount(remaining, ref.holding.amount);
    }
  }
  state.holdings[party] = state.holdings[party].filter((ref) => !spent.has(ref.cid));
}

/** Credit a party with a new unlocked holding of an instrument. */
function credit(partyId: string, admin: string, id: string, amount: string): void {
  const party = keyOf(partyId);
  if (!party) throw new Error('Unknown party to credit.');
  state.holdings[party].push({
    cid: nextCid('h-' + party),
    holding: { owner: partyId, instrumentId: { admin, id }, amount, lock: undefined, meta: {} },
  });
}

/** Release an allocation's backing to its leg sender and drop the allocation. */
function releaseAllocation(alloc: TokenAllocationRef): void {
  const leg = alloc.allocation.allocation.transferLeg;
  credit(leg.sender, leg.instrumentId.admin, leg.instrumentId.id, leg.amount);
  for (const party of Object.keys(state.allocations) as DemoPartyKey[]) {
    state.allocations[party] = state.allocations[party].filter((a) => a.cid !== alloc.cid);
  }
}

export const demoStore = {
  reset(): void {
    state = freshState();
    cidCounter = 0;
  },

  holdingsOf(party: DemoPartyKey): TokenHoldingRef[] {
    return state.holdings[party].map((ref) => ({ cid: ref.cid, holding: { ...ref.holding } }));
  },

  requestsPending(): TokenAllocationRequestRef[] {
    return state.requests.map((r) => ({ cid: r.cid, request: r.request }));
  },

  allocationsOf(party: DemoPartyKey): TokenAllocationRef[] {
    return state.allocations[party].map((a) => ({ cid: a.cid, allocation: a.allocation }));
  },

  /** The leg ids of a request that currently have a matching allocation. */
  matchedLegIds(requestCid: string): string[] {
    const req = requestByCid(requestCid);
    return Object.keys(req.request.transferLegs).filter((legId) => {
      const alloc = findAllocation(requestCid, legId);
      return !!alloc && legMatches(alloc.allocation.allocation.transferLeg, req.request.transferLegs[legId]);
    });
  },

  /** Unlocked holding cids of a party for a specific instrument (for allocate selection). */
  unlockedCids(party: DemoPartyKey, admin: string, id: string): string[] {
    return state.holdings[party]
      .filter(
        (ref) =>
          !ref.holding.lock &&
          ref.holding.instrumentId.admin === admin &&
          ref.holding.instrumentId.id === id,
      )
      .map((ref) => ref.cid);
  },

  /** A party's spendable balance of an instrument. */
  balanceOf(party: DemoPartyKey, admin: string, id: string): string {
    return state.holdings[party]
      .filter((ref) => ref.holding.instrumentId.admin === admin && ref.holding.instrumentId.id === id)
      .reduce((sum, ref) => addAmount(sum, ref.holding.amount), '0.00');
  },

  /** The venue creates a new trade (allocation request) with two opposite legs. */
  createTrade(usdAmount: string, bondAmount: string, allocateBefore?: string, settleBefore?: string): string {
    const n = state.requests.length + cidCounter + 1;
    const cid = nextCid('ar');
    state.requests.push(
      buildTrade(
        'trade-' + n.toString(),
        cid,
        usdAmount,
        bondAmount,
        allocateBefore ?? DEFAULT_ALLOCATE_BEFORE,
        settleBefore ?? DEFAULT_SETTLE_BEFORE,
      ),
    );
    return cid;
  },

  /**
   * A sender allocates its leg: debit the selected holdings and create an allocation
   * whose spec is composed FROM the request. Guarded by `allocateBefore`.
   */
  allocate(party: DemoPartyKey, requestCid: string, legId: string, inputCids: string[]): string {
    const req = requestByCid(requestCid);
    if (now() >= req.request.settlement.allocateBefore) {
      throw new Error('Allocation window has closed (allocateBefore ' + req.request.settlement.allocateBefore + ').');
    }
    const leg = req.request.transferLegs[legId];
    if (!leg) throw new Error('Unknown leg: ' + legId);
    if (leg.sender !== PARTIES[party].partyId) {
      throw new Error('Only the leg sender can allocate this leg.');
    }
    if (findAllocation(requestCid, legId)) {
      throw new Error('This leg is already allocated.');
    }

    debit(party, leg.instrumentId.admin, leg.instrumentId.id, leg.amount, inputCids);

    const cid = nextCid('alloc-' + party);
    state.allocations[party].push({
      cid,
      allocation: {
        allocation: { settlement: req.request.settlement, transferLegId: legId, transferLeg: leg },
        holdingCids: [nextCid('backing-' + party)],
        meta: {},
      },
    });
    return cid;
  },

  /** A sender withdraws its own allocation before `allocateBefore`, releasing the backing. */
  withdrawAllocation(party: DemoPartyKey, allocationCid: string): void {
    const alloc = state.allocations[party].find((a) => a.cid === allocationCid);
    if (!alloc) throw new Error('Allocation not found: ' + allocationCid);
    const req = state.requests.find(
      (r) => r.cid === alloc.allocation.allocation.settlement.settlementRef.cid,
    );
    if (req && now() >= req.request.settlement.allocateBefore) {
      throw new Error('Cannot withdraw after allocateBefore.');
    }
    releaseAllocation(alloc);
  },

  /** The venue cancels a matched allocation (abort path), releasing the backing early. */
  cancelAllocation(allocationCid: string): void {
    for (const party of Object.keys(state.allocations) as DemoPartyKey[]) {
      const alloc = state.allocations[party].find((a) => a.cid === allocationCid);
      if (alloc) {
        releaseAllocation(alloc);
        return;
      }
    }
    throw new Error('Allocation not found: ' + allocationCid);
  },

  /**
   * The venue settles the trade atomically: verify an expected allocation exists for
   * EVERY leg and `now < settleBefore`, then move all legs in ONE mutation. Throws
   * listing the missing leg ids BEFORE any asset moves if a leg is unallocated or the
   * deadline passed (all or nothing).
   */
  settle(requestCid: string): void {
    const req = requestByCid(requestCid);
    if (now() >= req.request.settlement.settleBefore) {
      throw new Error('Settlement window has closed (settleBefore ' + req.request.settlement.settleBefore + ').');
    }
    const legIds = Object.keys(req.request.transferLegs);
    const matched: { legId: string; alloc: TokenAllocationRef; leg: TokenTransferLeg }[] = [];
    const missing: string[] = [];
    for (const legId of legIds) {
      const leg = req.request.transferLegs[legId];
      const alloc = findAllocation(requestCid, legId);
      if (alloc && legMatches(alloc.allocation.allocation.transferLeg, leg)) {
        matched.push({ legId, alloc, leg });
      } else {
        missing.push(legId);
      }
    }
    if (missing.length > 0) {
      throw new Error('Cannot settle: unallocated legs [' + missing.join(', ') + ']. Nothing moved.');
    }
    // All legs matched and in time: move every leg's backing to its receiver.
    for (const { alloc, leg } of matched) {
      credit(leg.receiver, leg.instrumentId.admin, leg.instrumentId.id, leg.amount);
      for (const party of Object.keys(state.allocations) as DemoPartyKey[]) {
        state.allocations[party] = state.allocations[party].filter((a) => a.cid !== alloc.cid);
      }
    }
    state.requests = state.requests.filter((r) => r.cid !== requestCid);
  },

  /** A leg sender rejects the trade: release its allocations and drop the request. */
  rejectRequest(requestCid: string, actorId: string): void {
    const req = requestByCid(requestCid);
    const senders = Object.values(req.request.transferLegs).map((leg) => leg.sender);
    if (!senders.includes(actorId)) {
      throw new Error('Only a transfer-leg sender can reject this trade.');
    }
    releaseRequestAllocations(requestCid);
    state.requests = state.requests.filter((r) => r.cid !== requestCid);
  },

  /** The venue withdraws the trade: release its allocations and drop the request. */
  withdrawRequest(requestCid: string): void {
    requestByCid(requestCid);
    releaseRequestAllocations(requestCid);
    state.requests = state.requests.filter((r) => r.cid !== requestCid);
  },
};

/** Release every allocation backing a request back to its senders. */
function releaseRequestAllocations(requestCid: string): void {
  const toRelease: TokenAllocationRef[] = [];
  for (const party of Object.keys(state.allocations) as DemoPartyKey[]) {
    for (const alloc of state.allocations[party]) {
      if (alloc.allocation.allocation.settlement.settlementRef.cid === requestCid) toRelease.push(alloc);
    }
  }
  for (const alloc of toRelease) releaseAllocation(alloc);
}
