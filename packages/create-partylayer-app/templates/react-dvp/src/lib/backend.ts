/**
 * The backend interface the hooks read/submit through, plus a demo implementation
 * against the in-memory store. Model 2: PartyLayer owns none of this; the dApp
 * supplies these fetchers. In real mode each method becomes an ACS query or a
 * registry-mediated / trade-app command submission (see the README "Real mode").
 */
import type {
  TokenHoldingRef,
  TokenAllocationRef,
  TokenAllocationRequestRef,
  AllocationInstructionRequest,
  AllocationActionRequest,
  AllocationRequestActionRequest,
} from '@partylayer/react/query';
import type { DemoPartyKey, SettleTrade, CreateTrade } from './types';
import { demoStore, latency } from './store';
import { PARTIES } from './fixtures';

export interface DvpBackend {
  /** ACS read: a party's holdings as `{ cid, holding }` refs. `null` means none yet. */
  readHoldings(party: DemoPartyKey, signal?: AbortSignal): Promise<TokenHoldingRef[] | null>;
  /** ACS read: the open trades (allocation requests). `null` means none yet. */
  readTrades(signal?: AbortSignal): Promise<TokenAllocationRequestRef[] | null>;
  /** ACS read: a party's allocations as `{ cid, allocation }` refs. `null` means none yet. */
  readAllocations(party: DemoPartyKey, signal?: AbortSignal): Promise<TokenAllocationRef[] | null>;
  /** Which leg ids of a trade currently have a matching allocation (venue view). */
  readMatchedLegs(requestCid: string, signal?: AbortSignal): Promise<string[]>;

  /** Submit: allocate a leg (create an allocation via the factory). */
  submitAllocation(request: AllocationInstructionRequest, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: act on a funded allocation (withdraw / cancel). */
  submitAllocationAction(request: AllocationActionRequest, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: respond to a trade request (reject / withdraw). */
  submitRequestAction(request: AllocationRequestActionRequest, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: the venue's atomic settle (a trade-app choice, via the generic useChoice). */
  submitSettle(vars: SettleTrade, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: the venue creates a new trade (its own settlement-app choice). */
  submitCreateTrade(vars: CreateTrade, signal?: AbortSignal): Promise<{ ok: true }>;
}

/** Reject if the caller aborted while we were "in flight". */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

function partyIdToKey(partyId: string): DemoPartyKey {
  for (const key of Object.keys(PARTIES) as DemoPartyKey[]) {
    if (PARTIES[key].partyId === partyId) return key;
  }
  throw new Error('Unknown party id: ' + partyId);
}

/** The allocation cid a party owns, matched by a request/leg an action targets. */
function findAllocationParty(allocationCid: string): DemoPartyKey {
  for (const key of Object.keys(PARTIES) as DemoPartyKey[]) {
    if (demoStore.allocationsOf(key).some((a) => a.cid === allocationCid)) return key;
  }
  throw new Error('Allocation not found: ' + allocationCid);
}

export const demoBackend: DvpBackend = {
  async readHoldings(party, signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.holdingsOf(party);
  },

  async readTrades(signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.requestsPending();
  },

  async readAllocations(party, signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.allocationsOf(party);
  },

  async readMatchedLegs(requestCid, signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.matchedLegIds(requestCid);
  },

  async submitAllocation(request, signal) {
    await latency();
    throwIfAborted(signal);
    // The allocation spec was composed from the request; map it back to the store's
    // requestCid + legId + sender. The sender selects backing holdings itself
    // (inputHoldingCids), which the store consumes.
    const requestCid = request.allocation.settlement.settlementRef.cid;
    if (!requestCid) throw new Error('Allocation is missing its settlement request cid.');
    const legId = request.allocation.transferLegId;
    const sender = partyIdToKey(request.allocation.transferLeg.sender);
    demoStore.allocate(sender, requestCid, legId, request.inputHoldingCids);
    return { ok: true };
  },

  async submitAllocationAction(request, signal) {
    await latency();
    throwIfAborted(signal);
    if (request.action === 'withdraw') {
      const party = findAllocationParty(request.allocationCid);
      demoStore.withdrawAllocation(party, request.allocationCid);
    } else if (request.action === 'cancel') {
      demoStore.cancelAllocation(request.allocationCid);
    } else {
      // executeTransfer is a per-allocation move; in this vertical the venue settles
      // all legs atomically instead, so it is not wired here.
      throw new Error('executeTransfer is settled atomically by the venue in this example.');
    }
    return { ok: true };
  },

  async submitRequestAction(request, signal) {
    await latency();
    throwIfAborted(signal);
    if (request.action === 'reject') {
      demoStore.rejectRequest(request.requestCid, request.actor);
    } else {
      demoStore.withdrawRequest(request.requestCid);
    }
    return { ok: true };
  },

  // The venue's settle is a dApp-specific trade choice, wired through the generic
  // useChoice. A real venue settles atomically via its trade contract's choice whose
  // body exercises Allocation_ExecuteTransfer per leg in a single transaction, which
  // is exactly why this is useChoice and not the per-allocation typed hook.
  async submitSettle(vars, signal) {
    await latency();
    throwIfAborted(signal);
    demoStore.settle(vars.requestCid);
    return { ok: true };
  },

  async submitCreateTrade(vars, signal) {
    await latency();
    throwIfAborted(signal);
    demoStore.createTrade(vars.usdAmount, vars.bondAmount);
    return { ok: true };
  },
};
