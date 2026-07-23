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
 *
 * INVALIDATION NOTE: the hooks that accept a `key` prop (useDamlContract,
 * useTokenHoldings, useTokenAllocations, useTransferInstructions) namespace it as
 * `partyLayerKeys.<name>({ key })`. The raw `key` you pass is NOT the queryKey, so
 * prefix-invalidating with the raw `key` silently matches nothing. Invalidate with
 * `queryClient.invalidateQueries({ queryKey: partyLayerKeys.<name>() })` to match
 * every instance, or `partyLayerKeys.<name>({ key: yourKey })` to match one.
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
   * Query: a CIP-0056 token-holdings read (a typed sibling of `damlContract`).
   * Optional opaque params (e.g. a `key` identifying the owner/instrument filter
   * the dApp keys on) are folded into the key so different reads cache
   * independently. PartyLayer is schema-agnostic, so the key is opaque (the dApp's
   * fetcher owns the actual query).
   */
  tokenHoldings: (params?: { key?: unknown }) =>
    [...partyLayerKeys.all, 'tokenHoldings', params ?? {}] as const,

  /**
   * Query: a CIP-0056 token-allocations read (a typed sibling of `tokenHoldings`).
   * Optional opaque params (e.g. a `key` identifying the executor/filter the dApp
   * keys on) are folded into the key so different reads cache independently.
   * PartyLayer is schema-agnostic, so the key is opaque (the dApp's fetcher owns
   * the actual query).
   */
  tokenAllocations: (params?: { key?: unknown }) =>
    [...partyLayerKeys.all, 'tokenAllocations', params ?? {}] as const,

  /**
   * Query: a CIP-0056 transfer-instructions read (a typed sibling of
   * `tokenHoldings`). Optional opaque params (e.g. a `key` identifying the
   * party/filter the dApp keys on) are folded into the key so different reads cache
   * independently. PartyLayer is schema-agnostic, so the key is opaque (the dApp's
   * fetcher owns the actual query).
   */
  transferInstructions: (params?: { key?: unknown }) =>
    [...partyLayerKeys.all, 'transferInstructions', params ?? {}] as const,

  /**
   * Mutation: exercise a DAML choice (the write counterpart of `damlContract`).
   * The dApp owns the exercise transport (Model 2), so this is just a stable
   * mutation key; the variables/result are the dApp's, not folded into the key.
   */
  exerciseChoice: () => [...partyLayerKeys.all, 'exerciseChoice'] as const,

  /**
   * Mutation: submit a CIP-0056 transfer (`TransferFactory_Transfer`), a typed
   * sibling of `exerciseChoice`. The dApp owns the registry-specific submit
   * transport (Model 2), so this is just a stable mutation key; the transfer/result
   * are the dApp's, not folded into the key.
   */
  transferInstruction: () => [...partyLayerKeys.all, 'transferInstruction'] as const,

  /**
   * Mutation: complete a pending CIP-0056 transfer instruction (accept, reject, or
   * withdraw), a typed sibling of `transferInstruction`. The dApp owns the
   * registry-specific submit transport (Model 2), so this is just a stable mutation
   * key; the request/result are the dApp's, not folded into the key.
   */
  transferInstructionAction: () => [...partyLayerKeys.all, 'transferInstructionAction'] as const,

  /**
   * Mutation: create a CIP-0056 allocation via the registry's factory
   * (`AllocationFactory_Allocate`), a typed sibling of `transferInstruction`. The
   * dApp owns the registry-specific submit transport (Model 2), so this is just a
   * stable mutation key; the request/result are the dApp's, not folded into the key.
   */
  allocationInstruction: () => [...partyLayerKeys.all, 'allocationInstruction'] as const,

  /**
   * Mutation: act on a funded CIP-0056 allocation (execute transfer, cancel, or
   * withdraw), a typed sibling of `transferInstructionAction`. The dApp owns the
   * registry-specific submit transport (Model 2), so this is just a stable mutation
   * key; the request/result are the dApp's, not folded into the key.
   */
  allocationAction: () => [...partyLayerKeys.all, 'allocationAction'] as const,
} as const;

export type PartyLayerKeys = typeof partyLayerKeys;
