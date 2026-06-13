import { describe, it, expect } from 'vitest';
import {
  CANTON_NETWORKS,
  toCAIP2Network,
  fromCAIP2Network,
  isValidCAIP2,
  detectNetworkMismatch,
  isRecognizedNetwork,
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

describe('detectNetworkMismatch', () => {
  it('flags a recognized different-network mismatch (normalized)', () => {
    expect(detectNetworkMismatch('devnet', 'mainnet')).toEqual({
      expected: 'canton:da-devnet',
      actual: 'canton:da-mainnet',
    });
    expect(detectNetworkMismatch('mainnet', 'testnet')).toEqual({
      expected: 'canton:da-mainnet',
      actual: 'canton:da-testnet',
    });
  });

  it('returns null when the networks are normalize-equal (no false positive)', () => {
    expect(detectNetworkMismatch('devnet', 'canton:da-devnet')).toBeNull();
    expect(detectNetworkMismatch('devnet', 'devnet')).toBeNull();
    expect(detectNetworkMismatch('canton:da-mainnet', 'mainnet')).toBeNull();
  });

  // ── The fail-open fix: a recognized expected vs an UNRECOGNIZED-but-different
  //    actual (e.g. canton:unknown, as popup/remote wallets report) is a
  //    MISMATCH — NOT silently accepted. The full matrix: ───────────────────────
  it('FLAGS known-vs-unknown (canton:unknown — the observed Walley case)', () => {
    expect(detectNetworkMismatch('mainnet', 'canton:unknown')).toEqual({
      expected: 'canton:da-mainnet',
      actual: 'canton:unknown',
    });
    // symmetric: unknown expected vs known actual
    expect(detectNetworkMismatch('canton:unknown', 'mainnet')).toEqual({
      expected: 'canton:unknown',
      actual: 'canton:da-mainnet',
    });
  });

  it('FLAGS known-vs-custom / cross-namespace different networks', () => {
    expect(detectNetworkMismatch('devnet', 'someCustom')).toEqual({
      expected: 'canton:da-devnet',
      actual: 'canton:someCustom',
    });
    expect(detectNetworkMismatch('devnet', 'eip155:1')).toEqual({
      expected: 'canton:da-devnet',
      actual: 'eip155:1',
    });
  });

  it('returns null when two UNRECOGNIZED values are EQUAL (same network — false-positive guard)', () => {
    // The control: two equal canton:unknown must NOT refuse (same-network restore).
    expect(detectNetworkMismatch('canton:unknown', 'canton:unknown')).toBeNull();
    expect(detectNetworkMismatch('someCustom', 'someCustom')).toBeNull();
  });

  it('unparseable input falls back to raw comparison (equal→null, different→mismatch; never fail-open)', () => {
    const longRef = 'this-reference-is-way-too-long-to-be-valid-caip2';
    // different → mismatch (no fail-open)
    expect(detectNetworkMismatch('devnet', longRef)).toEqual({
      expected: 'canton:da-devnet',
      actual: longRef,
    });
    // equal unparseable → same network → null
    expect(detectNetworkMismatch(longRef, longRef)).toBeNull();
  });
});

describe('isRecognizedNetwork', () => {
  it('recognizes well-known Canton networks (short + CAIP-2)', () => {
    for (const n of ['devnet', 'testnet', 'mainnet', 'local']) {
      expect(isRecognizedNetwork(n)).toBe(true);
    }
    expect(isRecognizedNetwork('canton:da-mainnet')).toBe(true);
  });
  it('does NOT recognize canton:unknown / other namespaces / unparseable', () => {
    expect(isRecognizedNetwork('canton:unknown')).toBe(false); // the Walley report
    expect(isRecognizedNetwork('someCustom')).toBe(false); // → canton:someCustom
    expect(isRecognizedNetwork('eip155:1')).toBe(false);
    expect(isRecognizedNetwork('')).toBe(false);
  });
});
