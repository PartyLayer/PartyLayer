/**
 * Typed seed data for the DvP demo backend, built from the REAL exported CIP-0056
 * types. A settlement venue plus two counterparties, two registry-administered
 * instruments (DEMO-USD, DEMO-BOND), seed holdings, and one open trade (an
 * allocation request with two opposite legs).
 */
import { toTrafficCost, type CostEstimation } from '@partylayer/react';
import type {
  TokenHolding,
  TokenHoldingRef,
  TokenAllocationRequestRef,
  TokenTransferLeg,
} from '@partylayer/react/query';
import type { DemoParty, DemoPartyKey, InstrumentConfig } from './types';

/**
 * The registry party that administers both instruments. NOT selectable as a demo
 * party: the executor (venue) and the registry admin are distinct roles.
 */
export const REGISTRY = 'registry::1220c0ffee';

export const PARTIES: Record<DemoPartyKey, DemoParty> = {
  venue: { key: 'venue', label: 'Venue', partyId: 'venue::12208a3f9b' },
  alice: { key: 'alice', label: 'Alice', partyId: 'alice::1220b7c142' },
  bob: { key: 'bob', label: 'Bob', partyId: 'bob::1220e4d9a0' },
};

export const PARTY_ORDER: DemoPartyKey[] = ['venue', 'alice', 'bob'];

export const USD: InstrumentConfig = { admin: REGISTRY, id: 'DEMO-USD', name: 'Demo USD' };
export const BOND: InstrumentConfig = { admin: REGISTRY, id: 'DEMO-BOND', name: 'Demo Bond' };

/** The two transfer-leg identifiers a trade settles across. */
export const LEG_USD = 'leg-usd';
export const LEG_BOND = 'leg-bond';

/** Far-future ISO deadlines for the seed trade (stable, not time-based). */
export const DEFAULT_ALLOCATE_BEFORE = '2027-01-01T00:00:00Z';
export const DEFAULT_SETTLE_BEFORE = '2027-01-02T00:00:00Z';

function holding(owner: string, admin: string, id: string, amount: string): TokenHolding {
  return { owner, instrumentId: { admin, id }, amount, lock: undefined, meta: {} };
}

/** The seed holdings: Alice holds USD, Bob holds BOND, the venue holds nothing. */
export function seedHoldings(): Record<DemoPartyKey, TokenHoldingRef[]> {
  return {
    venue: [],
    alice: [
      { cid: 'h-alice-usd-1', holding: holding(PARTIES.alice.partyId, USD.admin, USD.id, '300.00') },
      { cid: 'h-alice-usd-2', holding: holding(PARTIES.alice.partyId, USD.admin, USD.id, '50.00') },
    ],
    bob: [{ cid: 'h-bob-bond-1', holding: holding(PARTIES.bob.partyId, BOND.admin, BOND.id, '10.00') }],
  };
}

/**
 * Build a trade as an allocation request: two opposite legs (Alice pays USD to Bob,
 * Bob delivers BOND to Alice), an executor of the venue, and the given deadlines.
 */
export function buildTrade(
  tradeId: string,
  requestCid: string,
  usdAmount: string,
  bondAmount: string,
  allocateBefore: string,
  settleBefore: string,
): TokenAllocationRequestRef {
  const legUsd: TokenTransferLeg = {
    sender: PARTIES.alice.partyId,
    receiver: PARTIES.bob.partyId,
    amount: usdAmount,
    instrumentId: { admin: USD.admin, id: USD.id },
  };
  const legBond: TokenTransferLeg = {
    sender: PARTIES.bob.partyId,
    receiver: PARTIES.alice.partyId,
    amount: bondAmount,
    instrumentId: { admin: BOND.admin, id: BOND.id },
  };
  return {
    cid: requestCid,
    request: {
      settlement: {
        executor: PARTIES.venue.partyId,
        settlementRef: { id: tradeId, cid: requestCid },
        requestedAt: '2026-07-22T09:00:00Z',
        allocateBefore,
        settleBefore,
        meta: { venue: 'demo' },
      },
      transferLegs: { [LEG_USD]: legUsd, [LEG_BOND]: legBond },
      meta: { trade: tradeId },
    },
  };
}

/** The seed open trade: 100 USD against 5 BOND. */
export function seedRequests(): TokenAllocationRequestRef[] {
  return [buildTrade('trade-1', 'ar-cid-1', '100.00', '5.00', DEFAULT_ALLOCATE_BEFORE, DEFAULT_SETTLE_BEFORE)];
}

/**
 * A fixed fee estimate for CostPreview before a leg allocation. The three fields are
 * int64-as-string (`TrafficCost`); built with `toTrafficCost` re-exported from
 * `@partylayer/react`, so no direct core dependency is needed.
 */
export const FEE_ESTIMATE: CostEstimation = {
  estimationTimestamp: '2026-07-22T09:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('1500'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('900'),
  totalTrafficCostEstimation: toTrafficCost('2400'),
};
