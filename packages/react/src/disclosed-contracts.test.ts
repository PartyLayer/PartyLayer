/**
 * disclosed-contracts tests: the framework-free merge utility. Covers dedupe across
 * several lists (including undefined inputs), stable ordering, first occurrence
 * winning on a repeated contractId, pass-through of entries lacking a contractId,
 * debug fields surviving untouched, and the all-empty case.
 */
import { describe, it, expect } from 'vitest';
import {
  mergeDisclosedContracts,
  type TokenDisclosedContract,
} from './disclosed-contracts';

const dc = (contractId: string, extra?: Partial<TokenDisclosedContract>): TokenDisclosedContract => ({
  contractId,
  createdEventBlob: 'blob-' + contractId,
  ...extra,
});

describe('mergeDisclosedContracts', () => {
  it('flattens several lists in order, skipping undefined inputs', () => {
    const merged = mergeDisclosedContracts([dc('a'), dc('b')], undefined, [dc('c')]);
    expect(merged.map((e) => e.contractId)).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates by contractId with the first occurrence winning', () => {
    const first = dc('a', { createdEventBlob: 'FIRST' });
    const later = dc('a', { createdEventBlob: 'LATER' });
    const merged = mergeDisclosedContracts([first, dc('b')], [later, dc('c')]);
    expect(merged.map((e) => e.contractId)).toEqual(['a', 'b', 'c']);
    // The first 'a' wins; the later duplicate is dropped entirely.
    expect(merged.find((e) => e.contractId === 'a')?.createdEventBlob).toBe('FIRST');
  });

  it('keeps ordering stable across the deduplication', () => {
    const merged = mergeDisclosedContracts(
      [dc('x'), dc('y'), dc('z')],
      [dc('y'), dc('w'), dc('x')],
    );
    expect(merged.map((e) => e.contractId)).toEqual(['x', 'y', 'z', 'w']);
  });

  it('passes through entries lacking a contractId without deduplicating them', () => {
    const anon1: TokenDisclosedContract = { createdEventBlob: 'blob-1' };
    const anon2: TokenDisclosedContract = { createdEventBlob: 'blob-2' };
    const merged = mergeDisclosedContracts([anon1, dc('a')], [anon2, dc('a')]);
    // Both anonymous entries survive; the duplicate 'a' is dropped.
    expect(merged).toEqual([anon1, dc('a'), anon2]);
  });

  it('leaves debug fields untouched on the surviving entry', () => {
    const rich = dc('a', {
      templateId: 'pkg:Mod:Tpl',
      synchronizerId: 'sync::1220abcd',
      debugPackageName: 'my-package',
      debugPayload: { owner: 'alice', amount: '5.00' },
      debugCreatedAt: '2026-07-24T00:00:00Z',
    });
    const [only] = mergeDisclosedContracts([rich]);
    expect(only).toEqual(rich);
    expect(only.debugPayload).toEqual({ owner: 'alice', amount: '5.00' });
    expect(only.debugCreatedAt).toBe('2026-07-24T00:00:00Z');
  });

  it('returns an empty array when every input is empty or undefined', () => {
    expect(mergeDisclosedContracts()).toEqual([]);
    expect(mergeDisclosedContracts(undefined, [], undefined)).toEqual([]);
  });
});
