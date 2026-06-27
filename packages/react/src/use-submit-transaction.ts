'use client';

/**
 * @partylayer/react v2 — useSubmitTransaction (TanStack Query mutation).
 *
 * Wagmi-shaped: wraps the existing client submit path in `useMutation`. The
 * underlying logic is UNCHANGED — `mutationFn` calls
 * `client.submitTransaction(params)` (the same method the v1 context hook calls).
 * The QueryClient is supplied by the CONSUMER's `QueryClientProvider` (TanStack
 * Query is a peer dependency).
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `submitTransaction`      === `mutate`      (fire-and-forget)
 *   - `submitTransactionAsync` === `mutateAsync` (returns Promise<TxReceipt>; throws on error)
 * (Note: v1's `submitTransaction` returned `Promise<TxReceipt | null>` and swallowed
 * errors into `error` state; the v1 hook on the main entrypoint is preserved.)
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import type { SubmitTransactionParams, TxReceipt } from '@partylayer/sdk';
import { usePartyLayer } from './hooks';
import { partyLayerKeys } from './query-keys';

export interface UseSubmitTransactionParameters {
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   * Optimistic updates: `onMutate`/`onError`/`onSettled` pass through here. See
   * docs/react-optimistic-updates.md (and the `optimisticMutationOptions` helper).
   */
  mutation?: Omit<
    UseMutationOptions<TxReceipt, Error, SubmitTransactionParams>,
    'mutationFn' | 'mutationKey'
  >;
}

export type UseSubmitTransactionReturnType = UseMutationResult<TxReceipt, Error, SubmitTransactionParams> & {
  /** Submit a transaction (fire-and-forget). Alias of `mutate`. */
  submitTransaction: UseMutationResult<TxReceipt, Error, SubmitTransactionParams>['mutate'];
  /** Submit a transaction and await the receipt (throws on error). Alias of `mutateAsync`. */
  submitTransactionAsync: UseMutationResult<TxReceipt, Error, SubmitTransactionParams>['mutateAsync'];
};

export function useSubmitTransaction(
  parameters: UseSubmitTransactionParameters = {},
): UseSubmitTransactionReturnType {
  const client = usePartyLayer();

  const mutation = useMutation<TxReceipt, Error, SubmitTransactionParams>({
    ...parameters.mutation,
    mutationKey: partyLayerKeys.submitTransaction(),
    // Underlying submit path is UNCHANGED — same call the v1 hook makes.
    mutationFn: (params) => client.submitTransaction(params),
  });

  return {
    ...mutation,
    submitTransaction: mutation.mutate,
    submitTransactionAsync: mutation.mutateAsync,
  };
}
