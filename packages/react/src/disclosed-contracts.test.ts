/**
 * disclosed-contracts tests: the framework-free merge and synchronizer utilities.
 * Covers dedupe across several lists (including undefined inputs), stable ordering,
 * first occurrence winning on a repeated contractId, plain duplicate collapse within
 * one list, debug fields surviving untouched, and the all-empty case; then grouping
 * by synchronizer with order preserved and the single/empty/mixed assertion matrix.
 */
import { describe, it, expect } from 'vitest';
import {
  mergeDisclosedContracts,
  groupDisclosedContractsBySynchronizer,
  assertSingleSynchronizer,
  type TokenDisclosedContract,
} from './disclosed-contracts';

const dc = (contractId: string, extra?: Partial<TokenDisclosedContract>): TokenDisclosedContract => ({
  templateId: 'pkg:Mod:Tpl',
  contractId,
  createdEventBlob: 'blob-' + contractId,
  synchronizerId: 'sync::1220abcd',
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

  it('collapses a duplicate contractId within a single list to one entry', () => {
    const merged = mergeDisclosedContracts([dc('a'), dc('b'), dc('a')]);
    expect(merged.map((e) => e.contractId)).toEqual(['a', 'b']);
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

const SYNC_A = 'sync::1220aaaa';
const SYNC_B = 'sync::1220bbbb';

describe('groupDisclosedContractsBySynchronizer', () => {
  it('groups by synchronizerId, preserving input order within each group', () => {
    const a1 = dc('a1', { synchronizerId: SYNC_A });
    const b1 = dc('b1', { synchronizerId: SYNC_B });
    const a2 = dc('a2', { synchronizerId: SYNC_A });
    const groups = groupDisclosedContractsBySynchronizer([a1, b1, a2]);
    expect(Object.keys(groups)).toEqual([SYNC_A, SYNC_B]);
    expect(groups[SYNC_A]).toEqual([a1, a2]);
    expect(groups[SYNC_B]).toEqual([b1]);
  });

  it('returns an empty object for an empty input', () => {
    expect(groupDisclosedContractsBySynchronizer([])).toEqual({});
  });
});

describe('assertSingleSynchronizer', () => {
  it('returns the sole synchronizerId when every entry shares one', () => {
    const contracts = [dc('a', { synchronizerId: SYNC_A }), dc('b', { synchronizerId: SYNC_A })];
    expect(assertSingleSynchronizer(contracts)).toBe(SYNC_A);
  });

  it('returns undefined for an empty input', () => {
    expect(assertSingleSynchronizer([])).toBeUndefined();
  });

  it('throws listing both distinct ids when the set is mixed', () => {
    const contracts = [dc('a', { synchronizerId: SYNC_B }), dc('b', { synchronizerId: SYNC_A })];
    expect(() => assertSingleSynchronizer(contracts)).toThrow(SYNC_A);
    expect(() => assertSingleSynchronizer(contracts)).toThrow(SYNC_B);
  });

  it('composes with mergeDisclosedContracts output', () => {
    const factoryCtx = [dc('shared', { synchronizerId: SYNC_A }), dc('f', { synchronizerId: SYNC_A })];
    const choiceCtx = [dc('shared', { synchronizerId: SYNC_A }), dc('c', { synchronizerId: SYNC_A })];
    const merged = mergeDisclosedContracts(factoryCtx, choiceCtx);
    expect(merged.map((e) => e.contractId)).toEqual(['shared', 'f', 'c']);
    expect(assertSingleSynchronizer(merged)).toBe(SYNC_A);

    const mixed = mergeDisclosedContracts(factoryCtx, [dc('c', { synchronizerId: SYNC_B })]);
    expect(() => assertSingleSynchronizer(mixed)).toThrow(/multiple synchronizers/);
  });
});
