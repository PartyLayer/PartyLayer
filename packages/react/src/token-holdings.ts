'use client';

/**
 * @partylayer/react v2: useTokenHoldings (TanStack Query query).
 *
 * A CIP-0056 (Canton Token Standard) typed specialization of `useDamlContract`.
 * It reads a party's token holdings through a dApp-supplied fetcher and wraps it
 * in `useQuery`, exactly like `useDamlContract`. The only difference is that it is
 * TYPED to the CIP-0056 `HoldingV1` interface shape ({@link TokenHolding}) instead
 * of being generic over an arbitrary `T`.
 *
 * Scope: HOLDINGS READ only. No transfer, allocation, minting, or any write
 * logic. This is the first CIP-0056 helper.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like `useDamlContract` and
 * the cost hooks, this hook does **not** touch the PartyLayer client, does not
 * call `usePartyLayer`, and does not reach any ledger/validator itself. The dApp
 * supplies its OWN holdings-read fetcher (`read`), typically an active-contracts
 * query against its validator's ledger API filtered to the token-standard holding
 * interface, mapped into {@link TokenHolding}[]. This hook only wraps that fetcher
 * in `useQuery` and keys it: a thin, standard UX/cache layer over a query the dApp
 * already performs.
 *
 * `read` may resolve `null`: a party may have no holdings yet, or the query may be
 * intentionally absent, which is a successful result, not an error. So the data is
 * `TokenHolding[] | null`, and `holdings` may be `null`.
 *
 * `key` is folded into the `queryKey` so different owners/instrument filters cache
 * independently. The QueryClient is supplied by the CONSUMER's
 * `QueryClientProvider`.
 *
 * Example of how a dApp might implement `read` (stays in the dApp, NOT in the
 * hook): query the validator's active-contracts endpoint with an interface filter
 * for `Splice.Api.Token.HoldingV1:Holding`, then map each active contract's
 * interface view into a {@link TokenHolding}:
 *
 *   const read = async (signal) => {
 *     const acs = await fetchActiveContracts(
 *       { interfaceId: 'Splice.Api.Token.HoldingV1:Holding', party: owner },
 *       signal,
 *     );
 *     return acs.map((c) => ({
 *       cid: c.contractId, // the ACS contract id, kept alongside the view
 *       holding: {
 *         owner: c.view.owner,
 *         instrumentId: { admin: c.view.instrumentId.admin, id: c.view.instrumentId.id },
 *         amount: c.view.amount, // decimal-as-string, verbatim
 *         lock: c.view.lock ?? undefined,
 *         meta: c.view.meta ?? undefined,
 *       },
 *     }));
 *   };
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';

import type { TokenHoldingRef } from '@partylayer/core';
export type { TokenInstrumentId, TokenLock, TokenHolding, TokenHoldingRef } from '@partylayer/core';

export interface UseTokenHoldingsParameters {
  /**
   * The dApp's holdings-read fetcher. Queries the dApp's own validator/ledger for
   * the party's CIP-0056 holding contracts and resolves them mapped into
   * {@link TokenHoldingRef}[] (each a `{ cid, holding }` pair), or `null` when
   * there are none yet / the read is absent (a successful result). Receives the
   * query's `AbortSignal` so the dApp can cancel in-flight requests.
   */
  read: (signal?: AbortSignal) => Promise<TokenHoldingRef[] | null>;
  /**
   * Opaque identifier for the holdings query being read (e.g. the owner party and
   * any instrument filter the dApp keys on). Folded into the queryKey so different
   * reads cache independently. Does not need to be forwarded to `read` (the dApp's
   * fetcher already closes over its query).
   *
   * INVALIDATION: the hook namespaces this key as
   * `partyLayerKeys.tokenHoldings({ key })`; the raw `key` is NOT the queryKey, so
   * prefix-invalidating with the raw `key` silently matches nothing. Invalidate
   * with `queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() })`
   * for every instance, or `({ key: yourKey })` for one.
   */
  key?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<TokenHoldingRef[] | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseTokenHoldingsReturnType = UseQueryResult<TokenHoldingRef[] | null, Error> & {
  /**
   * The holdings (alias of `data`), each a `{ cid, holding }` ref. `undefined`
   * until loaded; `null` when there are no holdings yet / the read is absent (a
   * successful result, not an error).
   */
  holdings: TokenHoldingRef[] | null | undefined;
};

export function useTokenHoldings(
  parameters: UseTokenHoldingsParameters,
): UseTokenHoldingsReturnType {
  const { read, key, query } = parameters;

  const result = useQuery<TokenHoldingRef[] | null, Error>({
    ...query,
    queryKey: partyLayerKeys.tokenHoldings({ key }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => read(signal),
  });

  return {
    ...result,
    holdings: result.data,
  };
}
