/**
 * Typed seed data for the demo backend, built from the REAL exported CIP-0056
 * types. Three demo parties, one instrument (`DEMO`), holdings per party (one
 * carrying a lock), a pending incoming transfer for alice, a static allocation for
 * the allocations card, and a fee estimate for CostPreview.
 */
import { toTrafficCost, type CostEstimation } from '@partylayer/core';
import type {
  TokenHolding,
  TokenTransfer,
  TokenAllocation,
} from '@partylayer/react/query';
import type {
  DemoParty,
  DemoPartyKey,
  HoldingRef,
  IncomingTransfer,
  InstrumentConfig,
  AllocationRef,
} from './types';

export const PARTIES: Record<DemoPartyKey, DemoParty> = {
  issuer: { key: 'issuer', label: 'Issuer', partyId: 'issuer::12208a3f9b' },
  alice: { key: 'alice', label: 'Alice', partyId: 'alice::1220b7c142' },
  bob: { key: 'bob', label: 'Bob', partyId: 'bob::1220e4d9a0' },
};

export const PARTY_ORDER: DemoPartyKey[] = ['issuer', 'alice', 'bob'];

export const INSTRUMENT: InstrumentConfig = {
  admin: PARTIES.issuer.partyId,
  id: 'DEMO',
  name: 'Demo Token',
  description: 'A demo instrument administered by the issuer party for this example.',
};

/** A far-future ISO timestamp for the lock and allocation deadlines (stable, not time-based). */
const FUTURE = '2027-01-01T00:00:00Z';

function holding(owner: string, amount: string, lock?: TokenHolding['lock']): TokenHolding {
  return {
    owner,
    instrumentId: { admin: INSTRUMENT.admin, id: INSTRUMENT.id },
    amount,
    lock,
    meta: {},
  };
}

/** The seed holdings, as `{ cid, holding }` refs (the cid is the ACS contract id). */
export function seedHoldings(): Record<DemoPartyKey, HoldingRef[]> {
  return {
    issuer: [{ cid: 'h-issuer-treasury', holding: holding(PARTIES.issuer.partyId, '1000000.00') }],
    alice: [
      { cid: 'h-alice-1', holding: holding(PARTIES.alice.partyId, '150.00') },
      {
        cid: 'h-alice-2',
        holding: holding(PARTIES.alice.partyId, '50.00', {
          holders: [PARTIES.issuer.partyId],
          expiresAt: FUTURE,
          context: 'frozen by issuer',
        }),
      },
    ],
    bob: [{ cid: 'h-bob-1', holding: holding(PARTIES.bob.partyId, '75.00') }],
  };
}

/** The seed incoming transfers, keyed by receiver party. Alice has one pending. */
export function seedIncoming(): Record<DemoPartyKey, IncomingTransfer[]> {
  const transfer: TokenTransfer = {
    sender: PARTIES.bob.partyId,
    receiver: PARTIES.alice.partyId,
    amount: '25.00',
    instrumentId: { admin: INSTRUMENT.admin, id: INSTRUMENT.id },
    requestedAt: '2026-07-22T09:00:00Z',
    executeBefore: FUTURE,
    inputHoldingCids: ['h-bob-1'],
    meta: { memo: 'lunch split' },
  };
  return {
    issuer: [],
    alice: [{ instructionCid: 'ti-bob-alice-1', transfer, status: 'pending' }],
    bob: [],
  };
}

/** A static allocation for the read-only allocations card (alice funds a settlement leg). */
export function seedAllocations(): AllocationRef[] {
  const allocation: TokenAllocation = {
    allocation: {
      settlement: {
        executor: PARTIES.issuer.partyId,
        settlementRef: { id: 'settlement-demo-1', cid: 'settle-cid-1' },
        requestedAt: '2026-07-22T09:00:00Z',
        allocateBefore: FUTURE,
        settleBefore: FUTURE,
      },
      transferLegId: 'leg-1',
      transferLeg: {
        sender: PARTIES.alice.partyId,
        receiver: PARTIES.bob.partyId,
        amount: '10.00',
        instrumentId: { admin: INSTRUMENT.admin, id: INSTRUMENT.id },
      },
    },
    holdingCids: ['h-alice-1'],
    meta: { settlement: 'demo' },
  };
  return [{ cid: 'alloc-cid-1', allocation }];
}

/**
 * A fixed fee estimate for CostPreview. The three fields are int64-as-string
 * (`TrafficCost`); built with the `toTrafficCost` constructor. FINDING: that
 * constructor lives in `@partylayer/core`, not re-exported from `@partylayer/react`,
 * so composing a CostPreview estimate pulls in a second package.
 */
export const FEE_ESTIMATE: CostEstimation = {
  estimationTimestamp: '2026-07-22T09:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('1200'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('800'),
  totalTrafficCostEstimation: toTrafficCost('2000'),
};
