import { describe, expect, it } from 'vitest';
import { parseTokenAccount, parseTokenHoldingV1, parseTokenHoldingV2, tokenHoldingOwner } from './token-accounts';

const common = { instrumentId: { admin: 'issuer', id: 'USD' }, amount: '9999999999999999999999999999.1234567890', meta: { values: { symbol: 'USD' } } };
describe('token standard account-aware holdings', () => {
  it('keeps V1 distinct from V2 and preserves exact decimals and metadata', () => {
    expect(parseTokenHoldingV1({ owner: 'alice', ...common })).toEqual({ owner: 'alice', ...common, meta: { symbol: 'USD' } });
    expect(() => parseTokenHoldingV2({ owner: 'alice', ...common })).toThrow();
    expect(() => parseTokenHoldingV1({ account: { owner: 'alice', id: '' }, ...common })).toThrow();
  });
  it('retains default, managed and special accounts without turning a provider into an owner', () => {
    expect(parseTokenAccount({ owner: 'alice', provider: null, id: '' })).toEqual({ owner: 'alice', id: '' });
    const holding = parseTokenHoldingV2({ account: { owner: null, provider: 'alice', id: 'mint' }, ...common });
    expect(holding.account).toEqual({ provider: 'alice', id: 'mint' });
    expect(tokenHoldingOwner(holding)).toBeUndefined();
    expect(tokenHoldingOwner(parseTokenHoldingV1({ owner: 'alice', ...common }))).toBe('alice');
  });
  it('preserves empty lock context and relative expiry without treating reported locks as expired', () => {
    expect(parseTokenHoldingV2({ account: { owner: 'alice', id: '1' }, ...common,
      lock: { holders: ['provider'], context: '', expiresAfter: '0.000001' } }).lock)
      .toEqual({ holders: ['provider'], context: '', expiresAfter: '0.000001' });
  });
  it.each(['1e10', '-1', 'NaN', '0.12345678901', '10000000000000000000000000000', 1])('rejects invalid amount %s', amount => {
    expect(() => parseTokenHoldingV2({ account: { owner: 'alice', id: '' }, ...common, amount })).toThrow();
  });
  it.each([{ owner: '', id: '' }, { owner: 'alice' }, { owner: 'alice', id: 1 }, { provider: 'x\n', id: '' }])('rejects malformed account %j', account => {
    expect(() => parseTokenAccount(account)).toThrow();
  });
  it.each([{ lock: {} }, { lock: { holders: [1] } }, { lock: { holders: [], context: 1 } }, { meta: { values: { x: 1 } } }])('rejects malformed holding fields %j', fields => {
    expect(() => parseTokenHoldingV2({ account: { owner: 'alice', id: '' }, ...common, ...fields })).toThrow();
  });
});
