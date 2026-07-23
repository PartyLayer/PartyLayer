'use client';

/**
 * @partylayer/react v2: useTokenAllocations (TanStack Query query).
 *
 * A CIP-0056 (Canton Token Standard) typed specialization of `useDamlContract`
 * for the AllocationV1 interface, mirroring how `useTokenHoldings` works for
 * HoldingV1. It is the read-side allocation sibling of `useTokenHoldings`: the
 * dApp supplies its OWN allocations-read fetcher and the hook wraps it in
 * `useQuery` and keys it. The only difference from `useDamlContract` is that it is
 * TYPED to the CIP-0056 `AllocationView` shape ({@link TokenAllocation}) instead
 * of being generic over an arbitrary `T`.
 *
 * Scope: allocation READ only. The WRITE side (`Allocation_ExecuteTransfer`,
 * `Allocation_Cancel`, `Allocation_Withdraw`, and `AllocationFactory_Allocate` to
 * create an allocation) is registry-specific and off-ledger, exactly like the
 * transfer submit (getAllocationFactory + choiceContext + disclosedContracts). So
 * the write side belongs to the dApp and will land later as separate typed write
 * hooks (siblings of `useTransferInstruction`). This hook is the read side:
 * querying the standard, modelable `AllocationView`.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like `useTokenHoldings` and
 * `useDamlContract`, this hook does **not** touch the PartyLayer client, does not
 * call `usePartyLayer`, and does not reach any ledger/validator itself. The dApp
 * supplies its OWN allocations-read fetcher (`read`), typically an active-contracts
 * query against its validator's ledger API filtered to the token-standard
 * allocation interface, mapped into {@link TokenAllocation}[]. This hook only wraps
 * that fetcher in `useQuery` and keys it.
 *
 * `read` may resolve `null`: a party may have no allocations yet, or the query may
 * be intentionally absent, which is a successful result, not an error. So the data
 * is `TokenAllocation[] | null`, and `allocations` may be `null`.
 *
 * `key` is folded into the `queryKey` so different owners/filters cache
 * independently. The QueryClient is supplied by the CONSUMER's
 * `QueryClientProvider`.
 *
 * Example of how a dApp might implement `read` (stays in the dApp, NOT in the
 * hook): query the validator's active-contracts endpoint with an interface filter
 * for `Splice.Api.Token.AllocationV1:Allocation`, then map each active contract's
 * interface view into a {@link TokenAllocation}:
 *
 *   const read = async (signal) => {
 *     const acs = await fetchActiveContracts(
 *       { interfaceId: 'Splice.Api.Token.AllocationV1:Allocation', party: executor },
 *       signal,
 *     );
 *     return acs.map((c) => ({
 *       cid: c.contractId, // the ACS contract id, kept alongside the view
 *       allocation: {
 *         allocation: c.view.allocation,
 *         holdingCids: c.view.holdingCids,
 *         meta: c.view.meta ?? undefined,
 *       },
 *     }));
 *   };
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';
import type { TokenInstrumentId } from './token-holdings';

/**
 * One leg of a settlement transfer. Mirrors `TransferLeg` from
 * `Splice.Api.Token.AllocationV1` (Canton Token Standard). Reuses
 * {@link TokenInstrumentId} from the holdings hook.
 */
export interface TokenTransferLeg {
  /** The party sending the amount (Daml `Party`). */
  sender: string;
  /** The party receiving the amount (Daml `Party`). */
  receiver: string;
  /**
   * The amount to transfer, a decimal-as-string to preserve exact precision (Daml
   * `Decimal`). NEVER a JS `number`.
   */
  amount: string;
  /** The instrument being transferred. Reused from the holdings hook. */
  instrumentId: TokenInstrumentId;
  /** Free-form metadata, a string-to-string map (Daml `Metadata`). */
  meta?: Record<string, string>;
}

/**
 * A reference to some contract. Mirrors `Reference` from
 * `Splice.Api.Token.AllocationV1` (a reference to some contract id).
 */
export interface TokenSettlementReference {
  /** The reference identifier (Daml `Text`). */
  id: string;
  /** The referenced contract id, when present (Daml `Optional (ContractId AnyContract)`). */
  cid?: string;
}

/**
 * Settlement metadata for an allocation. Mirrors `SettlementInfo` from
 * `Splice.Api.Token.AllocationV1`.
 */
export interface TokenSettlementInfo {
  /** The party executing the settlement (Daml `Party`). */
  executor: string;
  /** A reference to the settlement this allocation is part of. */
  settlementRef: TokenSettlementReference;
  /** When the settlement was requested, an ISO 8601 timestamp (Daml `Time`). */
  requestedAt: string;
  /** Deadline by which the allocation must be created, an ISO 8601 timestamp (Daml `Time`). */
  allocateBefore: string;
  /** Deadline by which the settlement must complete, an ISO 8601 timestamp (Daml `Time`). */
  settleBefore: string;
  /** Free-form metadata, a string-to-string map (Daml `Metadata`). */
  meta?: Record<string, string>;
}

/**
 * The specification of an allocation. Mirrors `AllocationSpecification` from
 * `Splice.Api.Token.AllocationV1`.
 */
export interface TokenAllocationSpecification {
  /** The settlement this allocation is part of. */
  settlement: TokenSettlementInfo;
  /** The identifier of the transfer leg within the settlement (Daml `Text`). */
  transferLegId: string;
  /** The transfer leg this allocation locks funds for. */
  transferLeg: TokenTransferLeg;
}

/**
 * A CIP-0056 allocation. Mirrors `AllocationView` from
 * `Splice.Api.Token.AllocationV1` (Canton Token Standard, Splice, Apache-2.0,
 * Digital Asset). A dApp reading raw ledger JSON maps each allocation contract's
 * interface view into this shape.
 */
export interface TokenAllocation {
  /** The specification of what this allocation locks and for whom. */
  allocation: TokenAllocationSpecification;
  /**
   * The locked holding contract ids backing the allocation (Daml
   * `[ContractId Holding]`). MAY be empty for registries that do not represent
   * holdings on-ledger.
   */
  holdingCids: string[];
  /** Free-form metadata, a string-to-string map (Daml `Metadata`). */
  meta?: Record<string, string>;
}

/**
 * An allocation as an ACS query returns it: a contract id paired with its
 * interface view. The unit a dApp reads is `{ cid, view }`, not the view alone:
 * the `cid` is what feeds `AllocationActionRequest.allocationCid`, while
 * `allocation` stays a byte-exact `AllocationView` mirror (the standard view
 * carries no contract id).
 */
export interface TokenAllocationRef {
  /** The allocation contract's id (Daml `ContractId Allocation`). */
  cid: string;
  /** The standard allocation view. */
  allocation: TokenAllocation;
}

export interface UseTokenAllocationsParameters {
  /**
   * The dApp's allocations-read fetcher. Queries the dApp's own validator/ledger
   * for the party's CIP-0056 allocation contracts and resolves them mapped into
   * {@link TokenAllocationRef}[] (each a `{ cid, allocation }` pair), or `null`
   * when there are none yet / the read is absent (a successful result). Receives
   * the query's `AbortSignal` so the dApp can cancel in-flight requests.
   */
  read: (signal?: AbortSignal) => Promise<TokenAllocationRef[] | null>;
  /**
   * Opaque identifier for the allocations query being read (e.g. the executor
   * party and any filter the dApp keys on). Folded into the queryKey so different
   * reads cache independently. Does not need to be forwarded to `read` (the dApp's
   * fetcher already closes over its query).
   *
   * INVALIDATION: the hook namespaces this key as
   * `partyLayerKeys.tokenAllocations({ key })`; the raw `key` is NOT the queryKey,
   * so prefix-invalidating with the raw `key` silently matches nothing. Invalidate
   * with `queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenAllocations() })`
   * for every instance, or `({ key: yourKey })` for one.
   */
  key?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<TokenAllocationRef[] | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseTokenAllocationsReturnType = UseQueryResult<TokenAllocationRef[] | null, Error> & {
  /**
   * The allocations (alias of `data`), each a `{ cid, allocation }` ref.
   * `undefined` until loaded; `null` when there are none yet / the read is absent
   * (a successful result, not an error).
   */
  allocations: TokenAllocationRef[] | null | undefined;
};

export function useTokenAllocations(
  parameters: UseTokenAllocationsParameters,
): UseTokenAllocationsReturnType {
  const { read, key, query } = parameters;

  const result = useQuery<TokenAllocationRef[] | null, Error>({
    ...query,
    queryKey: partyLayerKeys.tokenAllocations({ key }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => read(signal),
  });

  return {
    ...result,
    allocations: result.data,
  };
}
