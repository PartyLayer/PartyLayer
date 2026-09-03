/**
 * Guard: the yardstick must not drift into the surface.
 *
 * CIP0103_MANDATORY_METHODS is what the conformance suite iterates, and that
 * suite is published for wallet vendors to test themselves. Every entry in it
 * arrives in a vendor's report as an obligation. CIP0103_METHODS is a different
 * thing: the surface this SDK speaks, which is a superset by one non-spec
 * method.
 *
 * These were the same value once (`Object.values(CIP0103_METHODS)`), and the
 * moment the SDK learned a method the standard does not define, that derivation
 * started exporting our extension as somebody else's requirement. This file
 * exists so that recoupling them fails loudly rather than silently widening
 * what we assert about other people's software.
 *
 * SPEC_METHODS below is written out independently on purpose. It is read off
 * the specification's synchronous dApp API method table, not off either
 * constant, so it can actually disagree with them. A fixture derived from the
 * thing it checks would pass no matter what the code did.
 *
 * If the specification adds or removes a method, change SPEC_METHODS in the
 * same commit that changes CIP0103_MANDATORY_METHODS, and cite the spec change.
 */

import { describe, it, expect } from 'vitest';
import { CIP0103_METHODS, CIP0103_MANDATORY_METHODS } from './cip0103-types';

/**
 * The CIP-0103 specification's synchronous dApp API method table, verbatim.
 * Source: https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md
 */
const SPEC_METHODS = [
  'connect',
  'disconnect',
  'isConnected',
  'status',
  'getActiveNetwork',
  'listAccounts',
  'getPrimaryAccount',
  'signMessage',
  'prepareExecute',
  'ledgerApi',
] as const;

/** Methods this SDK speaks that the specification does not define. */
const KNOWN_NON_SPEC = ['prepareExecuteAndWait'] as const;

describe('CIP0103_MANDATORY_METHODS is the specification, not our surface', () => {
  it('contains exactly the ten methods the spec mandates', () => {
    expect([...CIP0103_MANDATORY_METHODS].sort()).toEqual([...SPEC_METHODS].sort());
    expect(CIP0103_MANDATORY_METHODS).toHaveLength(10);
  });

  it('is not derived from CIP0103_METHODS', () => {
    // The recoupling guard. If someone restores
    // `Object.values(CIP0103_METHODS)`, MANDATORY grows to include every
    // non-spec method and this fails.
    const surface = Object.values(CIP0103_METHODS);
    expect(CIP0103_MANDATORY_METHODS.length).toBeLessThan(surface.length);
    for (const m of KNOWN_NON_SPEC) {
      expect(CIP0103_MANDATORY_METHODS).not.toContain(m);
    }
  });

  it('is a strict subset of the surface, so nothing is mandated that we cannot speak', () => {
    const surface = new Set<string>(Object.values(CIP0103_METHODS));
    for (const m of CIP0103_MANDATORY_METHODS) {
      expect(surface.has(m)).toBe(true);
    }
  });
});

describe('CIP0103_METHODS is the surface this SDK speaks', () => {
  it('covers every mandated method plus the known non-spec ones', () => {
    const surface = Object.values(CIP0103_METHODS);
    expect([...surface].sort()).toEqual([...SPEC_METHODS, ...KNOWN_NON_SPEC].sort());
  });

  it('declares prepareExecuteAndWait, which two adapters call', () => {
    // Removing it to "match the spec" breaks the WalletConnect and Send
    // adapters, which drive it deliberately. See the comment on the constant.
    expect(Object.values(CIP0103_METHODS)).toContain('prepareExecuteAndWait');
  });
});
