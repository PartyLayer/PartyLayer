'use client';

/**
 * @partylayer/react v2: useDamlContract (TanStack Query query).
 *
 * The read-side analog of wagmi's `useReadContract`, and the read counterpart to
 * `useChoice` (the write/exercise hook). It reads a DAML contract through a
 * dApp-supplied fetcher and wraps it in `useQuery`.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like the cost hooks, this
 * hook does **not** touch the PartyLayer client, does not call `usePartyLayer`,
 * and does not reach any ledger/validator itself. The dApp supplies its OWN
 * contract-read fetcher (`read`), typically a query against its validator's
 * ledger API for active contracts, and this hook only wraps that fetcher in
 * `useQuery` and keys it. That keeps it ledgerApi-independent, wallet-agnostic,
 * and generic-bridge-compatible: a thin, standard UX/cache layer over a query the
 * dApp already performs.
 *
 * SCHEMA-AGNOSTIC: PartyLayer does not know the dApp's DAML schema, so the hook is
 * GENERIC over `T` (the contract data the dApp's query returns) and the
 * cache-identifying `key` is OPAQUE (`unknown`): a template id, contract id, or
 * filter the dApp keys on. The hook deliberately does not model template/choice/
 * args; the dApp's fetcher closes over the actual query.
 *
 * `read` may resolve `null`: a contract can be absent or archived, which is a
 * successful result, not an error. So `T | null`, and `contract` may be `null`.
 *
 * `key` is folded into the `queryKey` so different contracts/queries cache
 * independently. The QueryClient is supplied by the CONSUMER's
 * `QueryClientProvider`.
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';

export interface UseDamlContractParameters<T> {
  /**
   * The dApp's contract-read fetcher. Queries the dApp's own validator/ledger for
   * the contract and resolves its data, or `null` when the contract is
   * absent/archived. Receives the query's `AbortSignal` so the dApp can cancel
   * in-flight requests.
   */
  read: (signal?: AbortSignal) => Promise<T | null>;
  /**
   * Opaque identifier for the contract/query being read (a template id, contract
   * id, or filter the dApp keys on). Folded into the queryKey so different reads
   * cache independently. Does not need to be forwarded to `read` (the dApp's
   * fetcher already closes over its query).
   *
   * INVALIDATION: the hook namespaces this key as
   * `partyLayerKeys.damlContract({ key })`; the raw `key` is NOT the queryKey, so
   * prefix-invalidating with the raw `key` silently matches nothing. Invalidate
   * with `queryClient.invalidateQueries({ queryKey: partyLayerKeys.damlContract() })`
   * for every instance, or `({ key: yourKey })` for one.
   */
  key?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<T | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseDamlContractReturnType<T> = UseQueryResult<T | null, Error> & {
  /**
   * The contract data (alias of `data`). `undefined` until loaded; `null` when
   * the contract is absent/archived (a successful result, not an error).
   */
  contract: T | null | undefined;
};

export function useDamlContract<T>(
  parameters: UseDamlContractParameters<T>,
): UseDamlContractReturnType<T> {
  const { read, key, query } = parameters;

  const result = useQuery<T | null, Error>({
    ...query,
    queryKey: partyLayerKeys.damlContract({ key }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => read(signal),
  });

  return {
    ...result,
    contract: result.data,
  };
}
