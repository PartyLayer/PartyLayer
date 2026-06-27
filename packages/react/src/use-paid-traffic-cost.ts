'use client';

/**
 * @partylayer/react v2: usePaidTrafficCost (TanStack Query query).
 *
 * The post-execution ACTUAL-cost twin of `useTransactionCostEstimate`.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Unlike `useWallets` (which
 * wraps `client.listWallets`), this hook does **not** touch the PartyLayer client,
 * does not call `usePartyLayer`, and does not reach any ledger/validator itself.
 * The dApp supplies its OWN fetcher (`fetch`), typically reading the completion's
 * `paidTrafficCost` from its own validator, and this hook only wraps that fetcher
 * in `useQuery` and types it with core's `PaidTrafficCost`. That keeps it
 * ledgerApi-independent, wallet-agnostic, and generic-bridge-compatible: a thin,
 * standard UX layer over a field the dApp already has access to.
 *
 * `paidTrafficCost` is OPTIONAL (e.g. absent for updates initiated by another
 * participant, or processed before the node served traffic cost on the Ledger
 * API), so the fetcher returns `PaidTrafficCost | null` and `paidTrafficCost` may
 * be `null`. That is a successful result, not an error.
 *
 * `input` is an opaque identifier for the transaction whose actual cost this is;
 * it is folded into the `queryKey` so different transactions cache independently.
 * The QueryClient is supplied by the CONSUMER's `QueryClientProvider`.
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { PaidTrafficCost } from '@partylayer/core';
import { partyLayerKeys } from './query-keys';

export interface UsePaidTrafficCostParameters {
  /**
   * The dApp's fetcher. Reads the completion's `paidTrafficCost` from the dApp's
   * own validator (authoritative for command-driven flows) and resolves it, or
   * `null` when the cost is absent. Receives the query's `AbortSignal` so the
   * dApp can cancel in-flight requests.
   */
  fetch: (signal?: AbortSignal) => Promise<PaidTrafficCost | null>;
  /**
   * Opaque identifier for the transaction whose actual cost this is. Folded into
   * the queryKey so different transactions cache independently. Does not need to
   * be forwarded to `fetch` (the dApp's fetcher already closes over its tx).
   */
  input?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<PaidTrafficCost | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UsePaidTrafficCostReturnType = UseQueryResult<PaidTrafficCost | null, Error> & {
  /**
   * The actual paid traffic cost (alias of `data`). `undefined` until loaded;
   * `null` when absent (a successful result, not an error).
   */
  paidTrafficCost: PaidTrafficCost | null | undefined;
};

export function usePaidTrafficCost(
  parameters: UsePaidTrafficCostParameters,
): UsePaidTrafficCostReturnType {
  const { fetch, input, query } = parameters;

  const result = useQuery<PaidTrafficCost | null, Error>({
    ...query,
    queryKey: partyLayerKeys.paidTrafficCost({ input }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => fetch(signal),
  });

  return {
    ...result,
    paidTrafficCost: result.data,
  };
}
