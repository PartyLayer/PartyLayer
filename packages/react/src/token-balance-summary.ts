import type { TokenHoldingRef, TokenInstrumentId } from './token-holdings';
import { sumTokenAmounts } from '@partylayer/core/amounts';
export { sumTokenAmounts } from '@partylayer/core/amounts';

export interface TokenBalanceSummary {
  owner: string;
  instrumentId: TokenInstrumentId;
  total: string;
  available: string;
  locked: string;
  holdingCount: number;
}

/** Owner-filtered, admin/id-separated totals. A reported lock stays locked until the ledger changes it. */
export function summarizeTokenHoldings(holdings: readonly TokenHoldingRef[], owner: string): TokenBalanceSummary[] {
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('A holding owner is required');
  const groups = new Map<string, { instrumentId: TokenInstrumentId; available: string[]; locked: string[] }>();
  const seen = new Set<string>();
  for (const reference of holdings) {
    if (!reference?.holding || typeof reference.holding.owner !== 'string' || !reference.holding.owner.trim()) throw new Error('Holding owner is required');
    if (reference.holding.owner !== owner) continue;
    const { cid, holding } = reference;
    if (typeof cid !== 'string' || !cid.trim() || seen.has(cid)) throw new Error('Holding contract ids must be present and unique');
    seen.add(cid);
    const instrument = holding.instrumentId;
    if (!instrument || typeof instrument.admin !== 'string' || !instrument.admin.trim() || typeof instrument.id !== 'string' || !instrument.id.trim()) {
      throw new Error('Holding instrument admin and id are required');
    }
    sumTokenAmounts([holding.amount]);
    const key = JSON.stringify([instrument.admin, instrument.id]);
    let group = groups.get(key);
    if (!group) {
      group = { instrumentId: { admin: instrument.admin, id: instrument.id }, available: [], locked: [] };
      groups.set(key, group);
    }
    (holding.lock ? group.locked : group.available).push(holding.amount);
  }
  return [...groups.values()].map(group => ({
    owner, instrumentId: group.instrumentId,
    total: sumTokenAmounts([...group.available, ...group.locked]),
    available: sumTokenAmounts(group.available), locked: sumTokenAmounts(group.locked),
    holdingCount: group.available.length + group.locked.length,
  })).sort((left, right) => {
    const a = JSON.stringify([left.instrumentId.admin, left.instrumentId.id]);
    const b = JSON.stringify([right.instrumentId.admin, right.instrumentId.id]);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
