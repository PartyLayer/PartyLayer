/**
 * Query-key factory for @partylayer/vue (TanStack vue-query v5).
 *
 * Mirrors @partylayer/react's `partyLayerKeys` exactly: query keys are just
 * arrays, so the two packages share the same hierarchical key shapes and their
 * caches stay consistent. Wagmi-style hierarchy: a single root scope (`all`) plus
 * a factory per operation, so consumers and our composables can invalidate
 * precisely (e.g. `queryClient.invalidateQueries({ queryKey: partyLayerKeys.all })`
 * clears everything; `partyLayerKeys.wallets()` clears just the wallet list).
 *
 * Keys are `as const` tuples so TanStack's structural matching is exact and the
 * key shape is part of the public, stable contract.
 */
export const partyLayerKeys = {
  /** Root scope for every PartyLayer query/mutation key. */
  all: ['partylayer'] as const,

  /** Mutation: connect a wallet. */
  connect: () => [...partyLayerKeys.all, 'connect'] as const,

  /** Mutation: disconnect the active session. */
  disconnect: () => [...partyLayerKeys.all, 'disconnect'] as const,

  /** Mutation: sign a message. */
  signMessage: () => [...partyLayerKeys.all, 'signMessage'] as const,

  /** Mutation: submit a transaction. */
  submitTransaction: () => [...partyLayerKeys.all, 'submitTransaction'] as const,

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

  /**
   * Query: a transaction cost estimate. Optional opaque params (e.g. an `input`
   * identifying the transaction) are folded into the key so different
   * transactions cache independently.
   */
  transactionCostEstimate: (params?: { input?: unknown }) =>
    [...partyLayerKeys.all, 'transactionCostEstimate', params ?? {}] as const,

  /**
   * Query: the actual paid traffic cost of a transaction (post-execution).
   * Optional opaque params (e.g. an `input` identifying the transaction) are
   * folded into the key so different transactions cache independently.
   */
  paidTrafficCost: (params?: { input?: unknown }) =>
    [...partyLayerKeys.all, 'paidTrafficCost', params ?? {}] as const,

  /**
   * Query: a DAML contract read. Optional opaque params (e.g. a `key`
   * identifying the contract/query: a template id, contract id, or filter the
   * dApp keys on) are folded into the key so different reads cache independently.
   * PartyLayer is schema-agnostic, so the key is opaque (the dApp's fetcher owns
   * the actual query).
   */
  damlContract: (params?: { key?: unknown }) =>
    [...partyLayerKeys.all, 'damlContract', params ?? {}] as const,

  /**
   * Mutation: exercise a DAML choice (the write counterpart of `damlContract`).
   * The dApp owns the exercise transport (Model 2), so this is just a stable
   * mutation key; the variables/result are the dApp's, not folded into the key.
   */
  exerciseChoice: () => [...partyLayerKeys.all, 'exerciseChoice'] as const,
} as const;

export type PartyLayerKeys = typeof partyLayerKeys;
