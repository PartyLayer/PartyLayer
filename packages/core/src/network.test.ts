import { describe, it, expect } from 'vitest';
import {
  CANTON_NETWORKS,
  toCAIP2Network,
  fromCAIP2Network,
  isValidCAIP2,
} from './network';

describe('CANTON_NETWORKS', () => {
  it('maps the well-known short names to CAIP-2', () => {
    expect(CANTON_NETWORKS).toMatchObject({
      mainnet: 'canton:da-mainnet',
      testnet: 'canton:da-testnet',
      devnet: 'canton:da-devnet',
      local: 'canton:da-local',
    });
  });
});

describe('toCAIP2Network', () => {
  it('maps well-known short names', () => {
    expect(toCAIP2Network('devnet')).toEqual({ networkId: 'canton:da-devnet' });
    expect(toCAIP2Network('testnet')).toEqual({ networkId: 'canton:da-testnet' });
    expect(toCAIP2Network('mainnet')).toEqual({ networkId: 'canton:da-mainnet' });
    expect(toCAIP2Network('local')).toEqual({ networkId: 'canton:da-local' });
  });

  it('passes through an already-CAIP-2 string', () => {
    expect(toCAIP2Network('canton:da-mainnet')).toEqual({ networkId: 'canton:da-mainnet' });
  });

  it('namespaces an unknown short name under canton:', () => {
    expect(toCAIP2Network('foonet')).toEqual({ networkId: 'canton:foonet' });
  });

  it('throws on an invalid CAIP-2 result', () => {
    expect(() => toCAIP2Network('canton:this-reference-is-way-too-long-to-be-valid')).toThrow(
      /Invalid CAIP-2/,
    );
  });
});

describe('fromCAIP2Network', () => {
  it('reverse-maps known CAIP-2 ids to short names', () => {
    expect(fromCAIP2Network('canton:da-mainnet')).toBe('mainnet');
    expect(fromCAIP2Network('canton:da-devnet')).toBe('devnet');
  });

  it('returns the reference part for unknown CAIP-2 ids', () => {
    expect(fromCAIP2Network('canton:foonet')).toBe('foonet');
  });

  it('returns the input when there is no colon', () => {
    expect(fromCAIP2Network('plainstring')).toBe('plainstring');
  });
});

describe('isValidCAIP2', () => {
  it('accepts valid namespace:reference', () => {
    expect(isValidCAIP2('canton:da-mainnet')).toBe(true);
    expect(isValidCAIP2('eip155:1')).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect(isValidCAIP2('mainnet')).toBe(false); // no colon
    expect(isValidCAIP2('canton:')).toBe(false); // empty reference
    expect(isValidCAIP2('x:1')).toBe(false); // namespace too short
  });
});
