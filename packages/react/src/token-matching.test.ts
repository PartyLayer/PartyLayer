/**
 * token-matching tests: the framework-free spec comparators. Covers the decimal
 * equality matrix (no float conversion), transfer-leg equality (including the meta
 * undefined-versus-empty case and a decimal-formatting case), settlement equality
 * (including the optional cid cases), and the full allocationMatchesRequestLeg
 * matrix.
 */
import { describe, it, expect } from 'vitest';
import {
  tokenDecimalEquals,
  tokenTransferLegEquals,
  tokenSettlementInfoEquals,
  allocationMatchesRequestLeg,
} from './token-matching';
import type {
  TokenTransferLeg,
  TokenSettlementInfo,
  TokenAllocation,
} from './token-allocations';
import type { TokenAllocationRequest } from './token-allocation-requests';

describe('tokenDecimalEquals', () => {
  it('treats formatting differences as equal without float conversion', () => {
    expect(tokenDecimalEquals('5', '5.00')).toBe(true);
    expect(tokenDecimalEquals('5.10', '5.1')).toBe(true);
    expect(tokenDecimalEquals('0', '0.000')).toBe(true);
    expect(tokenDecimalEquals('0', '-0')).toBe(true);
    expect(tokenDecimalEquals('0.000', '-0')).toBe(true);
    expect(tokenDecimalEquals('007', '7')).toBe(true);
    expect(tokenDecimalEquals('+7', '7')).toBe(true);
  });

  it('distinguishes genuinely different amounts', () => {
    expect(tokenDecimalEquals('5.1', '5.11')).toBe(false);
    expect(tokenDecimalEquals('5', '50')).toBe(false);
    expect(tokenDecimalEquals('5', '-5')).toBe(false);
  });

  it('preserves precision on large decimals (would break under float)', () => {
    expect(tokenDecimalEquals('9007199254740993', '9007199254740993.0')).toBe(true);
    expect(tokenDecimalEquals('9007199254740993', '9007199254740992')).toBe(false);
  });

  it('falls back to strict string equality for non-decimals', () => {
    expect(tokenDecimalEquals('abc', 'abc')).toBe(true);
    expect(tokenDecimalEquals('abc', 'abd')).toBe(false);
    expect(tokenDecimalEquals('5', 'abc')).toBe(false);
    expect(tokenDecimalEquals('', '')).toBe(true);
  });
});

const leg = (amount: string, meta?: Record<string, string>): TokenTransferLeg => ({
  sender: 'party::sender-1',
  receiver: 'party::receiver-1',
  amount,
  instrumentId: { admin: 'party::registry', id: 'USD' },
  meta,
});

describe('tokenTransferLegEquals', () => {
  it('matches when amounts differ only by formatting', () => {
    expect(tokenTransferLegEquals(leg('5'), leg('5.00'))).toBe(true);
  });

  it('normalizes undefined meta to an empty record', () => {
    expect(tokenTransferLegEquals(leg('5', undefined), leg('5', {}))).toBe(true);
    expect(tokenTransferLegEquals(leg('5', { a: '1' }), leg('5', { a: '1' }))).toBe(true);
    expect(tokenTransferLegEquals(leg('5', { a: '1' }), leg('5', { a: '2' }))).toBe(false);
    expect(tokenTransferLegEquals(leg('5', { a: '1' }), leg('5', {}))).toBe(false);
  });

  it('distinguishes different parties, instruments, and amounts', () => {
    expect(tokenTransferLegEquals(leg('5'), { ...leg('5'), receiver: 'party::other' })).toBe(false);
    expect(tokenTransferLegEquals(leg('5'), { ...leg('5'), instrumentId: { admin: 'party::registry', id: 'BOND' } })).toBe(false);
    expect(tokenTransferLegEquals(leg('5'), leg('6'))).toBe(false);
  });
});

const settlement = (over?: Partial<TokenSettlementInfo>): TokenSettlementInfo => ({
  executor: 'party::venue',
  settlementRef: { id: 'settlement-1', cid: 'settle-cid-1' },
  requestedAt: '2026-07-22T09:00:00Z',
  allocateBefore: '2027-01-01T00:00:00Z',
  settleBefore: '2027-01-02T00:00:00Z',
  meta: {},
  ...over,
});

describe('tokenSettlementInfoEquals', () => {
  it('matches identical settlements', () => {
    expect(tokenSettlementInfoEquals(settlement(), settlement())).toBe(true);
  });

  it('handles the optional cid: both absent equal, one absent not', () => {
    expect(
      tokenSettlementInfoEquals(
        settlement({ settlementRef: { id: 'settlement-1' } }),
        settlement({ settlementRef: { id: 'settlement-1' } }),
      ),
    ).toBe(true);
    expect(
      tokenSettlementInfoEquals(
        settlement({ settlementRef: { id: 'settlement-1', cid: 'x' } }),
        settlement({ settlementRef: { id: 'settlement-1' } }),
      ),
    ).toBe(false);
  });

  it('distinguishes different refs and timestamps', () => {
    expect(tokenSettlementInfoEquals(settlement(), settlement({ settlementRef: { id: 'other', cid: 'settle-cid-1' } }))).toBe(false);
    expect(tokenSettlementInfoEquals(settlement(), settlement({ settleBefore: '2028-01-01T00:00:00Z' }))).toBe(false);
  });
});

/** Build a request and a matching allocation from the same settlement/leg. */
function scenario() {
  const usdLeg: TokenTransferLeg = {
    sender: 'party::alice',
    receiver: 'party::bob',
    amount: '100.00',
    instrumentId: { admin: 'party::registry', id: 'USD' },
  };
  const request: TokenAllocationRequest = {
    settlement: {
      executor: 'party::venue',
      settlementRef: { id: 'trade-1', cid: 'ar-cid-1' },
      requestedAt: '2026-07-22T09:00:00Z',
      allocateBefore: '2027-01-01T00:00:00Z',
      settleBefore: '2027-01-02T00:00:00Z',
      meta: {},
    },
    transferLegs: { 'leg-usd': usdLeg },
    meta: {},
  };
  const allocation: TokenAllocation = {
    allocation: {
      settlement: request.settlement,
      transferLegId: 'leg-usd',
      // Amount formatted differently on purpose: "100" vs "100.00" must still match.
      transferLeg: { ...usdLeg, amount: '100' },
    },
    holdingCids: ['backing-1'],
    meta: {},
  };
  return { request, allocation };
}

describe('allocationMatchesRequestLeg', () => {
  it('true for an exact match (amount formatted differently)', () => {
    const { request, allocation } = scenario();
    expect(allocationMatchesRequestLeg(allocation, request, 'leg-usd')).toBe(true);
  });

  it('false for a wrong legId', () => {
    const { request, allocation } = scenario();
    expect(allocationMatchesRequestLeg(allocation, request, 'leg-bond')).toBe(false);
  });

  it('false when the request does not have the leg', () => {
    const { request, allocation } = scenario();
    const { 'leg-usd': _removed, ...rest } = request.transferLegs;
    void _removed;
    expect(allocationMatchesRequestLeg(allocation, { ...request, transferLegs: rest }, 'leg-usd')).toBe(false);
  });

  it('false for a different receiver', () => {
    const { request, allocation } = scenario();
    const bad: TokenAllocation = {
      ...allocation,
      allocation: {
        ...allocation.allocation,
        transferLeg: { ...allocation.allocation.transferLeg, receiver: 'party::carol' },
      },
    };
    expect(allocationMatchesRequestLeg(bad, request, 'leg-usd')).toBe(false);
  });

  it('false for a different settlementRef.id', () => {
    const { request, allocation } = scenario();
    const bad: TokenAllocation = {
      ...allocation,
      allocation: {
        ...allocation.allocation,
        settlement: { ...allocation.allocation.settlement, settlementRef: { id: 'other', cid: 'ar-cid-1' } },
      },
    };
    expect(allocationMatchesRequestLeg(bad, request, 'leg-usd')).toBe(false);
  });
});

it('compares long decimal fractions without trailing-zero backtracking', () => {
  const fraction = '0'.repeat(100_000) + '1';
  expect(tokenDecimalEquals('1.' + fraction, '+1.' + fraction)).toBe(true);
});
