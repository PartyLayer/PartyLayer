'use client';

/**
 * @partylayer/react v2: useTransactionCostEstimate (TanStack Query query).
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Unlike `useWallets` (which
 * wraps `client.listWallets`), this hook does **not** touch the PartyLayer client,
 * does not call `usePartyLayer`, and does not reach any ledger/validator itself.
 * The dApp supplies its OWN cost-fetcher (`estimate`), typically a call to its
 * validator's `/v2/interactive-submission/prepare`, and this hook only wraps that
 * fetcher in `useQuery` and types it with core's `CostEstimation`. That keeps it
 * ledgerApi-independent, wallet-agnostic, and generic-bridge-compatible: a thin,
 * standard UX layer over a field the dApp already has access to.
 *
 * `costEstimation` is OPTIONAL on the prepare response (it may be disabled or
 * absent), so the fetcher returns `CostEstimation | null` and `costEstimate` may
 * be `null`. That is a successful result, not an error.
 *
 * `input` is an opaque identifier for the transaction being estimated; it is
 * folded into the `queryKey` so different transactions cache independently. The
 * QueryClient is supplied by the CONSUMER's `QueryClientProvider`.
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { CostEstimation } from '@partylayer/core';
import { partyLayerKeys } from './query-keys';

export interface UseTransactionCostEstimateParameters {
  /**
   * The dApp's cost-fetcher. Calls the dApp's own validator
   * (`/v2/interactive-submission/prepare`) and resolves the estimate, or `null`
   * when cost estimation is disabled/absent. Receives the query's `AbortSignal`
   * so the dApp can cancel in-flight requests.
   */
  estimate: (signal?: AbortSignal) => Promise<CostEstimation | null>;
  /**
   * Opaque identifier for the transaction being estimated. Folded into the
   * queryKey so different transactions cache independently. Does not need to be
   * forwarded to `estimate` (the dApp's fetcher already closes over its tx).
   */
  input?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<CostEstimation | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseTransactionCostEstimateReturnType = UseQueryResult<CostEstimation | null, Error> & {
  /**
   * The cost estimate (alias of `data`). `undefined` until loaded; `null` when
   * estimation is disabled/absent (a successful result, not an error).
   */
  costEstimate: CostEstimation | null | undefined;
};

export function useTransactionCostEstimate(
  parameters: UseTransactionCostEstimateParameters,
): UseTransactionCostEstimateReturnType {
  const { estimate, input, query } = parameters;

  const result = useQuery<CostEstimation | null, Error>({
    ...query,
    queryKey: partyLayerKeys.transactionCostEstimate({ input }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => estimate(signal),
  });

  return {
    ...result,
    costEstimate: result.data,
  };
}
