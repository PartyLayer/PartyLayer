import type { TokenHoldingRef, TokenInstrumentId } from './token-holdings';
import { parseTokenAccount, type AnyTokenHoldingRef, type TokenAccount } from '@partylayer/core';
import { sumTokenAmounts } from '@partylayer/core/amounts';
export { sumTokenAmounts } from '@partylayer/core/amounts';

export interface TokenBalanceSummary {
  owner: string;
  instrumentId: TokenInstrumentId;
  total: string;
  available: string;
  locked: string;
  holdingCount: number;
  /** Present for V2. Separate provider/account numbers are never merged. */
  account?: TokenAccount;
}

/** Owner-filtered, admin/id-separated totals. A reported lock stays locked until the ledger changes it. */
export function summarizeTokenHoldings(holdings: readonly AnyTokenHoldingRef[], owner: string): TokenBalanceSummary[] {
  if (typeof owner !== 'string' || !owner.trim()) throw new Error('A holding owner is required');
  const groups = new Map<string, { instrumentId: TokenInstrumentId; account?: TokenAccount; available: string[]; locked: string[] }>();
  const seen = new Set<string>();
  for (const reference of holdings) {
    if (!reference?.holding) throw new Error('Holding owner is required');
    const account = 'account' in reference.holding ? parseTokenAccount(reference.holding.account) : undefined;
    const holdingOwner = account ? account.owner : (reference as TokenHoldingRef).holding.owner;
    if (!account && (typeof holdingOwner !== 'string' || !holdingOwner.trim())) throw new Error('Holding owner is required');
    if (holdingOwner !== owner) continue;
    const { cid, holding } = reference;
    if (typeof cid !== 'string' || !cid.trim() || seen.has(cid)) throw new Error('Holding contract ids must be present and unique');
    seen.add(cid);
    const instrument = holding.instrumentId;
    if (!instrument || typeof instrument.admin !== 'string' || !instrument.admin.trim() || typeof instrument.id !== 'string' || !instrument.id.trim()) {
      throw new Error('Holding instrument admin and id are required');
    }
    sumTokenAmounts([holding.amount]);
    if (holding.lock !== undefined && holding.lock !== null &&
      (typeof holding.lock !== 'object' || Array.isArray(holding.lock) || !Array.isArray(holding.lock.holders) ||
        holding.lock.holders.some(holder => typeof holder !== 'string' || !holder.trim()))) {
      throw new Error('Invalid holding lock');
    }
    const key = JSON.stringify([instrument.admin, instrument.id, account ? [account.provider ?? null, account.id] : null]);
    let group = groups.get(key);
    if (!group) {
      group = { instrumentId: { admin: instrument.admin, id: instrument.id }, ...(account ? { account } : {}), available: [], locked: [] };
      groups.set(key, group);
    }
    (holding.lock ? group.locked : group.available).push(holding.amount);
  }
  return [...groups.values()].map(group => ({
    owner, instrumentId: group.instrumentId,
    total: sumTokenAmounts([...group.available, ...group.locked]),
    available: sumTokenAmounts(group.available), locked: sumTokenAmounts(group.locked),
    holdingCount: group.available.length + group.locked.length,
    ...(group.account ? { account: group.account } : {}),
  })).sort((left, right) => {
    const a = JSON.stringify([left.instrumentId.admin, left.instrumentId.id, left.account ?? null]);
    const b = JSON.stringify([right.instrumentId.admin, right.instrumentId.id, right.account ?? null]);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
