'use client';

/**
 * @partylayer/react v2: useAllocationRequests (TanStack Query query).
 *
 * A CIP-0056 (Canton Token Standard) typed READ hook for pending allocation
 * requests, mirroring `useTransferInstructions` for the `AllocationRequestView`. An
 * allocation request is a settlement app's ON-LEDGER request to its parties, asking
 * the senders of the transfer legs to allocate the assets that back a settlement.
 * This reads the requests a party could act on. Model 2: the dApp supplies its OWN
 * read fetcher (an ACS query for `AllocationRequest` contracts, mapped to the typed
 * view), and the hook wraps it in `useQuery` and keys it.
 *
 * DISCOVERY: implementations SHOULD make at least all senders of the transfer legs
 * observers of the contract, so wallets discover pending requests via an ACS
 * interface-filter query for the `AllocationRequest` interface.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like `useTransferInstructions`,
 * this hook does **not** touch the PartyLayer client, does not call `usePartyLayer`,
 * and does not reach any ledger/validator itself. The dApp supplies its own
 * requests-read fetcher, typically an active-contracts query filtered to the
 * token-standard allocation-request interface, mapped into
 * {@link TokenAllocationRequestRef}[].
 *
 * `read` may resolve `null`: a party may have no pending requests, a successful
 * result, not an error. So the data is `TokenAllocationRequestRef[] | null`, and
 * `requests` may be `null`.
 *
 * Example of a dApp `read` (stays in the dApp, NOT in the hook):
 *
 *   const read = async (signal) => {
 *     const acs = await fetchActiveContracts(
 *       { interfaceId: 'Splice.Api.Token.AllocationRequestV1:AllocationRequest', party },
 *       signal,
 *     );
 *     return acs.map((c) => ({
 *       cid: c.contractId, // feeds AllocationRequestActionRequest.requestCid
 *       request: {
 *         settlement: c.view.settlement,
 *         transferLegs: c.view.transferLegs,
 *         meta: c.view.meta ?? undefined,
 *       },
 *     }));
 *   };
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';
import type { TokenSettlementInfo, TokenTransferLeg } from './token-allocations';

/**
 * A pending allocation request. Mirrors `AllocationRequestView` from
 * `Splice.Api.Token.AllocationRequestV1` (Canton Token Standard, Apache-2.0)
 * exactly (three fields). Reuses {@link TokenSettlementInfo} and
 * {@link TokenTransferLeg} from the allocations hook.
 */
export interface TokenAllocationRequest {
  /** The settlement this request is part of. */
  settlement: TokenSettlementInfo;
  /**
   * The transfer legs to allocate, keyed by the transfer leg identifier (Daml
   * `TextMap TransferLeg`). This may or may not be the COMPLETE list of the
   * settlement's legs, depending on the confidentiality requirements of the app.
   */
  transferLegs: Record<string, TokenTransferLeg>;
  /** Free-form metadata, a string-to-string map (Daml `Metadata`). */
  meta?: Record<string, string>;
}

/**
 * An allocation request as an ACS query returns it: a contract id paired with its
 * interface view. The `cid` feeds `AllocationRequestActionRequest.requestCid` and
 * is what a settlement app turns into its `settlementRef`; the `request` stays a
 * byte-exact `AllocationRequestView` mirror.
 */
export interface TokenAllocationRequestRef {
  /** The request contract's id (Daml `ContractId AllocationRequest`). */
  cid: string;
  /** The standard allocation-request view. */
  request: TokenAllocationRequest;
}

export interface UseAllocationRequestsParameters {
  /**
   * The dApp's requests-read fetcher. Queries the dApp's own validator/ledger for
   * the party's CIP-0056 allocation-request contracts and resolves them mapped into
   * {@link TokenAllocationRequestRef}[] (each a `{ cid, request }` pair), or `null`
   * when there are none yet / the read is absent (a successful result). Receives the
   * query's `AbortSignal` so the dApp can cancel in-flight requests.
   */
  read: (signal?: AbortSignal) => Promise<TokenAllocationRequestRef[] | null>;
  /**
   * Opaque identifier for the requests query being read (e.g. the party and any
   * filter the dApp keys on). Folded into the queryKey so different reads cache
   * independently. Does not need to be forwarded to `read` (the dApp's fetcher
   * already closes over its query).
   *
   * INVALIDATION: the hook namespaces this key as
   * `partyLayerKeys.allocationRequests({ key })`; the raw `key` is NOT the queryKey,
   * so prefix-invalidating with the raw `key` silently matches nothing. Invalidate
   * with
   * `queryClient.invalidateQueries({ queryKey: partyLayerKeys.allocationRequests() })`
   * for every instance, or `({ key: yourKey })` for one.
   */
  key?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<
    UseQueryOptions<TokenAllocationRequestRef[] | null, Error>,
    'queryKey' | 'queryFn'
  >;
}

export type UseAllocationRequestsReturnType = UseQueryResult<
  TokenAllocationRequestRef[] | null,
  Error
> & {
  /**
   * The requests (alias of `data`), each a `{ cid, request }` ref. `undefined`
   * until loaded; `null` when there are none yet / the read is absent (a successful
   * result, not an error).
   */
  requests: TokenAllocationRequestRef[] | null | undefined;
};

export function useAllocationRequests(
  parameters: UseAllocationRequestsParameters,
): UseAllocationRequestsReturnType {
  const { read, key, query } = parameters;

  const result = useQuery<TokenAllocationRequestRef[] | null, Error>({
    ...query,
    queryKey: partyLayerKeys.allocationRequests({ key }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => read(signal),
  });

  return {
    ...result,
    requests: result.data,
  };
}
