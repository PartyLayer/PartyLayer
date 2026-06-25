/**
 * Traffic-cost type + helper tests.
 *
 * Verify the int64-safe representation: values beyond Number.MAX_SAFE_INTEGER
 * must round-trip without precision loss, and invalid inputs must throw.
 */

import { describe, it, expect } from 'vitest';
import { toTrafficCost, trafficCostToBigInt } from './cost';
import type { TrafficCost, CostEstimation, PaidTrafficCost } from './cost';

describe('toTrafficCost / trafficCostToBigInt', () => {
  it('accepts a decimal string and round-trips via trafficCostToBigInt', () => {
    const cost = toTrafficCost('12345');
    expect(cost).toBe('12345');
    expect(trafficCostToBigInt(cost)).toBe(12345n);
  });

  it('accepts a number', () => {
    const cost = toTrafficCost(4096);
    expect(cost).toBe('4096');
    expect(trafficCostToBigInt(cost)).toBe(4096n);
  });

  it('accepts a bigint', () => {
    const cost = toTrafficCost(987654321n);
    expect(cost).toBe('987654321');
    expect(trafficCostToBigInt(cost)).toBe(987654321n);
  });

  it('accepts zero', () => {
    expect(toTrafficCost(0)).toBe('0');
    expect(toTrafficCost('0')).toBe('0');
    expect(trafficCostToBigInt(toTrafficCost(0n))).toBe(0n);
  });

  it('canonicalizes leading zeros', () => {
    expect(toTrafficCost('007')).toBe('7');
  });

  // CRITICAL: int64 values above Number.MAX_SAFE_INTEGER must not lose precision.
  it('preserves an int64 value above Number.MAX_SAFE_INTEGER (string in -> bigint out)', () => {
    const maxInt64 = '9223372036854775807'; // 2^63 - 1
    expect(Number(maxInt64) > Number.MAX_SAFE_INTEGER).toBe(true);

    const cost = toTrafficCost(maxInt64);
    expect(cost).toBe('9223372036854775807'); // exact string preserved
    expect(trafficCostToBigInt(cost)).toBe(9223372036854775807n); // exact bigint, no loss
  });

  it('preserves a large value passed as bigint', () => {
    const cost = toTrafficCost(9223372036854775807n);
    expect(cost).toBe('9223372036854775807');
    expect(trafficCostToBigInt(cost)).toBe(9223372036854775807n);
  });

  describe('throws on invalid input', () => {
    it('negative string', () => {
      expect(() => toTrafficCost('-1')).toThrow();
    });
    it('negative number', () => {
      expect(() => toTrafficCost(-1)).toThrow();
    });
    it('negative bigint', () => {
      expect(() => toTrafficCost(-1n)).toThrow();
    });
    it('non-integer number', () => {
      expect(() => toTrafficCost(1.5)).toThrow();
    });
    it('non-integer string', () => {
      expect(() => toTrafficCost('1.5')).toThrow();
    });
    it('NaN', () => {
      expect(() => toTrafficCost(NaN)).toThrow();
    });
    it('Infinity', () => {
      expect(() => toTrafficCost(Infinity)).toThrow();
    });
    it('empty string', () => {
      expect(() => toTrafficCost('')).toThrow();
    });
    it('non-numeric string', () => {
      expect(() => toTrafficCost('abc')).toThrow();
    });
    it('number beyond MAX_SAFE_INTEGER (precision risk)', () => {
      expect(() => toTrafficCost(Number.MAX_SAFE_INTEGER + 2)).toThrow();
    });
  });

  it('type shapes line up (compile-time check)', () => {
    // CostEstimation uses TrafficCost for the three cost fields.
    const estimate: CostEstimation = {
      estimationTimestamp: '2026-06-25T15:00:00Z',
      confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
      confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
      totalTrafficCostEstimation: toTrafficCost('300'),
    };
    // PaidTrafficCost is assignable from a TrafficCost (it is an alias).
    const paid: PaidTrafficCost = toTrafficCost('300');
    const sum =
      trafficCostToBigInt(estimate.confirmationRequestTrafficCostEstimation) +
      trafficCostToBigInt(estimate.confirmationResponseTrafficCostEstimation);
    expect(sum).toBe(trafficCostToBigInt(estimate.totalTrafficCostEstimation));
    expect(trafficCostToBigInt(paid)).toBe(300n);
    const _typecheck: TrafficCost = paid; // PaidTrafficCost -> TrafficCost
    expect(_typecheck).toBe('300');
  });
});
