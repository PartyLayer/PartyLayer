/**
 * Query-key factory tests. The keys are framework-agnostic arrays mirroring
 * @partylayer/react's `partyLayerKeys`, so the Vue and React caches stay
 * consistent. These assert the hierarchical shapes (root scope plus per-operation
 * factories, with opaque params folded into the key).
 */
import { describe, it, expect } from 'vitest';
import { partyLayerKeys } from '../query-keys';

describe('partyLayerKeys (Vue, mirrors React)', () => {
  it('exposes a single root scope', () => {
    expect(partyLayerKeys.all).toEqual(['partylayer']);
  });

  it('mutation factories nest under the root scope', () => {
    expect(partyLayerKeys.connect()).toEqual(['partylayer', 'connect']);
    expect(partyLayerKeys.disconnect()).toEqual(['partylayer', 'disconnect']);
    expect(partyLayerKeys.signMessage()).toEqual(['partylayer', 'signMessage']);
    expect(partyLayerKeys.submitTransaction()).toEqual(['partylayer', 'submitTransaction']);
    expect(partyLayerKeys.exerciseChoice()).toEqual(['partylayer', 'exerciseChoice']);
  });

  it('simple query factories nest under the root scope', () => {
    expect(partyLayerKeys.account()).toEqual(['partylayer', 'account']);
    expect(partyLayerKeys.session()).toEqual(['partylayer', 'session']);
    expect(partyLayerKeys.registryStatus()).toEqual(['partylayer', 'registryStatus']);
  });

  it('parameterized factories fold opaque params into the key (default empty object)', () => {
    expect(partyLayerKeys.wallets()).toEqual(['partylayer', 'wallets', {}]);
    expect(partyLayerKeys.wallets({ filter: { includeExperimental: true } })).toEqual([
      'partylayer',
      'wallets',
      { filter: { includeExperimental: true } },
    ]);
    expect(partyLayerKeys.transactionCostEstimate({ input: 'tx-A' })).toEqual([
      'partylayer',
      'transactionCostEstimate',
      { input: 'tx-A' },
    ]);
    expect(partyLayerKeys.paidTrafficCost({ input: 'tx-B' })).toEqual([
      'partylayer',
      'paidTrafficCost',
      { input: 'tx-B' },
    ]);
    expect(partyLayerKeys.damlContract({ key: 'tmpl-1' })).toEqual([
      'partylayer',
      'damlContract',
      { key: 'tmpl-1' },
    ]);
  });

  it('different params produce distinct keys (independent caching)', () => {
    const a = partyLayerKeys.transactionCostEstimate({ input: 'tx-A' });
    const b = partyLayerKeys.transactionCostEstimate({ input: 'tx-B' });
    expect(a).not.toEqual(b);
  });
});
