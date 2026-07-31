import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateAllowed } from './format';

// F1: the live cost estimate hook gates on estimateAllowed, so proving this predicate is false
// for invalid input proves no estimate network call fires for it (the hook stays disabled).
test('estimateAllowed is false for over-balance, negative, or non-numeric input (no estimate fetch)', () => {
  const max = '100.00';
  assert.equal(estimateAllowed('150.00', max), false, 'over balance');
  assert.equal(estimateAllowed('-5.00', max), false, 'negative');
  assert.equal(estimateAllowed('abc', max), false, 'non-numeric');
  assert.equal(estimateAllowed('1.2.3', max), false, 'malformed number');
  assert.equal(estimateAllowed('1.234', max), false, 'too many decimals');
  assert.equal(estimateAllowed('0', max), false, 'zero');
  assert.equal(estimateAllowed('0.00', max), false, 'zero with decimals');
  assert.equal(estimateAllowed('', max), false, 'empty');
  assert.equal(estimateAllowed('   ', max), false, 'blank');
});

test('estimateAllowed is true for a valid amount within balance (estimate fetch allowed)', () => {
  assert.equal(estimateAllowed('1.00', '100.00'), true, 'well within balance');
  assert.equal(estimateAllowed('0.01', '100.00'), true, 'small positive');
  assert.equal(estimateAllowed('100.00', '100.00'), true, 'exactly the balance');
});
