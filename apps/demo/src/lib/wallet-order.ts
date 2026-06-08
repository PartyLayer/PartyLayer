/**
 * Single canonical wallet order for ALL demo-rendered wallet lists.
 *
 * Mirrors apps/marketing's tokens `wallets` source so the demo's own displays
 * (landing cards, kit-demo discovery cards, registered adapters) stay in one
 * consistent order — WalletConnect 4th — without each list hardcoding its own.
 * (The published WalletModal's internal ordering is separate; this only governs
 * lists the demo renders/sorts itself.)
 */
export const CANONICAL_WALLET_ORDER = [
  'console',
  'send',
  'loop',
  'walletconnect',
  'cantor8',
  'nightly',
  'bron',
] as const;

/** Rank of a wallet id in the canonical order; unknown ids sort to the end. */
export function canonicalRank(walletId: string): number {
  const id = walletId.replace(/^cip0103:/, '').toLowerCase();
  const i = (CANONICAL_WALLET_ORDER as readonly string[]).indexOf(id);
  return i === -1 ? CANONICAL_WALLET_ORDER.length : i;
}

/** Return a new array sorted by the canonical wallet order. */
export function sortByCanonicalOrder<T>(items: readonly T[], getId: (item: T) => string): T[] {
  return [...items].sort((a, b) => canonicalRank(getId(a)) - canonicalRank(getId(b)));
}
