/**
 * Coverage for the canonical CIP-0103 support flag.
 *
 * The flag governs which wallets are listed in the modal's "CIP-0103
 * NATIVE" section regardless of install state. Two guarantees we keep
 * test-pinned:
 *
 *   1. `isCip0103Native` is permissive about partial structures —
 *      missing field, undefined entry, false flag — so callers can use
 *      it as a single predicate without pre-narrowing.
 *   2. `registryEntryToWalletInfo` propagates the `cip0103` block
 *      verbatim AND keeps backward compatibility with entries that
 *      don't carry the new field at all.
 */

import { describe, it, expect } from 'vitest';
import { isCip0103Native, type Cip0103Support } from '@partylayer/core';

import { REGISTRY_SCHEMA_VERSION, registryEntryToWalletInfo, type RegistryWalletEntry } from './schema';

const baseEntry: RegistryWalletEntry = {
  id: 'mock',
  name: 'Mock Wallet',
  supportedNetworks: ['mainnet'],
  capabilities: {
    signMessage: true,
    signTransaction: false,
    submitTransaction: true,
    transactionStatus: true,
    switchNetwork: false,
    multiParty: false,
  },
  adapter: { type: '@example/mock-adapter' },
};

describe('isCip0103Native', () => {
  it('returns true when cip0103.native is true', () => {
    expect(isCip0103Native({ cip0103: { native: true } })).toBe(true);
  });

  it('returns false when cip0103.native is false', () => {
    expect(isCip0103Native({ cip0103: { native: false } })).toBe(false);
  });

  it('returns false when cip0103 is omitted (backward compat)', () => {
    expect(isCip0103Native({})).toBe(false);
  });

  it('returns false when cip0103 is undefined', () => {
    expect(isCip0103Native({ cip0103: undefined })).toBe(false);
  });

  it('treats unknown shapes safely (no exception)', () => {
    expect(isCip0103Native(undefined as unknown as { cip0103?: Cip0103Support })).toBe(false);
    expect(isCip0103Native(null as unknown as { cip0103?: Cip0103Support })).toBe(false);
  });
});

describe('registryEntryToWalletInfo: cip0103 propagation', () => {
  it('passes cip0103 through to WalletInfo when present', () => {
    const entry: RegistryWalletEntry = {
      ...baseEntry,
      cip0103: {
        native: true,
        evidence: 'https://example.org/evidence',
        since: '2026-04-01',
      },
    };
    const info = registryEntryToWalletInfo(entry, 'beta');
    expect(info.cip0103).toEqual(entry.cip0103);
    expect(isCip0103Native(info)).toBe(true);
  });

  it('omits cip0103 from WalletInfo when registry entry omits it', () => {
    const info = registryEntryToWalletInfo(baseEntry, 'stable');
    expect(info.cip0103).toBeUndefined();
    expect(isCip0103Native(info)).toBe(false);
  });

  it('preserves cip0103.native:false (explicit non-native)', () => {
    const entry: RegistryWalletEntry = {
      ...baseEntry,
      cip0103: { native: false },
    };
    const info = registryEntryToWalletInfo(entry, 'stable');
    expect(info.cip0103).toEqual({ native: false });
    expect(isCip0103Native(info)).toBe(false);
  });

  // Sanity-check that REGISTRY_SCHEMA_VERSION is still importable (catches
  // accidental breakage of the schema's other exports while we extend it).
  it('schema version constant remains exported', () => {
    expect(typeof REGISTRY_SCHEMA_VERSION).toBe('string');
  });
});
