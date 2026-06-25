/**
 * Query-key factory for @partylayer/react v2 (TanStack Query v5).
 *
 * Wagmi-style hierarchical keys: a single root scope (`all`) plus a factory per
 * operation, so consumers and our hooks can invalidate precisely (e.g.
 * `queryClient.invalidateQueries({ queryKey: partyLayerKeys.all })` clears
 * everything; `partyLayerKeys.wallets()` clears just the wallet list).
 *
 * Keys are `as const` tuples so TanStack's structural matching is exact and the
 * key shape is part of the public, stable contract.
 */
export const partyLayerKeys = {
  /** Root scope for every PartyLayer query/mutation key. */
  all: ['partylayer'] as const,

  /** Mutation: connect a wallet. */
  connect: () => [...partyLayerKeys.all, 'connect'] as const,

  /** Query: the active account/session-derived account. */
  account: () => [...partyLayerKeys.all, 'account'] as const,

  /** Query: the active session. */
  session: () => [...partyLayerKeys.all, 'session'] as const,

  /**
   * Query: the wallet list. Optional opaque params (e.g. a filter) are folded
   * into the key so different filters cache independently.
   */
  wallets: (params?: { filter?: unknown }) =>
    [...partyLayerKeys.all, 'wallets', params ?? {}] as const,

  /** Query: registry status. */
  registryStatus: () => [...partyLayerKeys.all, 'registryStatus'] as const,
} as const;

export type PartyLayerKeys = typeof partyLayerKeys;
