import { describe, expect, it } from 'vitest';
import { sumTokenAmounts } from './amounts';

describe('exact token amounts', () => {
  it('preserves amounts beyond JavaScript integer/fraction precision', () => {
    expect(sumTokenAmounts(['999999999999999999999999.0000000001', '0.0000000002']))
      .toBe('999999999999999999999999.0000000003');
    expect(sumTokenAmounts(['0.1', '0.2'])).toBe('0.3');
    expect(sumTokenAmounts(['999.99', '0.01'])).toBe('1000');
    expect(sumTokenAmounts([' +0005.000 ', '0.0000'])).toBe('5');
    expect(sumTokenAmounts([])).toBe('0');
  });
  it.each(['-1', 'NaN', 'Infinity', '1e-7', '1.', '.1', '', ' ', '1,000', '1'.repeat(257)])('rejects invalid or negative amounts: %s', amount => {
    expect(() => sumTokenAmounts([amount])).toThrow(/decimal string/);
  });
});
