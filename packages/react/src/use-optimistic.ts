'use client';

/**
 * @partylayer/react v2: optimisticMutationOptions (optimistic update + rollback helper).
 *
 * A small, generic helper that builds the `onMutate` / `onError` / `onSettled`
 * trio for the canonical TanStack optimistic-update pattern, ready to spread into
 * any PartyLayer mutation hook's `mutation` option. It does NOT change any hook:
 * the mutation hooks already pass these callbacks through (they manage only
 * `mutationFn` and `mutationKey`), so this is purely an ergonomic wrapper over
 * boilerplate the consumer could write by hand.
 *
 * WHAT IT DOES (the standard pattern):
 *  - `onMutate`: cancel in-flight fetches for `queryKey`, snapshot the current
 *    cached value, optimistically write the next value via `update`, and return
 *    the snapshot as context.
 *  - `onError`: roll back to the snapshot captured in `onMutate`.
 *  - `onSettled`: invalidate `queryKey` to resync with the server (toggle off via
 *    `invalidate: false`).
 *
 * WHERE IT APPLIES: it targets a TanStack query the CONSUMER owns (e.g. the dApp's
 * own contract list, or a `useDamlContract` query). It is the natural fit for the
 * dApp-cache mutations, `useSubmitTransaction` and `useChoice`, where a successful
 * write should optimistically reflect in the dApp's own query. It is NOT for
 * connect/disconnect (account state lives in the reactive session store, which is
 * already live, not a query cache) or `useSignMessage` (no cache). See
 * docs/react-optimistic-updates.md.
 *
 * @example Optimistically append a contract after a choice, rolling back on error:
 *   const queryClient = useQueryClient();
 *   const { exerciseChoice } = useChoice<Result, Vars>({
 *     exercise,
 *     mutation: optimisticMutationOptions<MyContract[], Vars>({
 *       queryClient,
 *       queryKey: ['my-app', 'contracts'],
 *       update: (previous, variables) => [...(previous ?? []), toOptimistic(variables)],
 *     }),
 *   });
 */
import type { QueryClient, QueryKey, UseMutationOptions } from '@tanstack/react-query';

export interface OptimisticMutationConfig<TQueryData, TVariables> {
  /** The consumer's QueryClient (from `useQueryClient()`). */
  queryClient: QueryClient;
  /** The query key whose cached value is optimistically updated and rolled back. */
  queryKey: QueryKey;
  /**
   * Given the previously cached value and the mutation variables, return the
   * optimistic next value to write into the cache.
   */
  update: (previous: TQueryData | undefined, variables: TVariables) => TQueryData;
  /**
   * Invalidate `queryKey` in `onSettled` to resync with the server. Defaults to
   * `true`; set `false` to skip the refetch (e.g. when the server response is
   * authoritative and already applied).
   */
  invalidate?: boolean;
}

/** Context captured by `onMutate` and consumed by `onError` for rollback. */
export interface OptimisticContext<TQueryData> {
  /** The cached value snapshotted before the optimistic write. */
  previous: TQueryData | undefined;
}

/**
 * Build the `{ onMutate, onError, onSettled }` trio for an optimistic update with
 * automatic rollback, to spread into a mutation hook's `mutation` option.
 *
 * Typed loosely on the context (the trio carries the snapshot internally) so it
 * spreads cleanly into any hook's `mutation` option without context-type friction.
 */
export function optimisticMutationOptions<TQueryData, TVariables = unknown>(
  config: OptimisticMutationConfig<TQueryData, TVariables>,
): Pick<UseMutationOptions<unknown, Error, TVariables>, 'onMutate' | 'onError' | 'onSettled'> {
  const { queryClient, queryKey, update, invalidate = true } = config;

  return {
    async onMutate(variables) {
      // Cancel outgoing refetches so they do not overwrite the optimistic write.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TQueryData>(queryKey);
      queryClient.setQueryData<TQueryData>(queryKey, (prev) => update(prev, variables));
      // Returned value becomes the `context` passed to onError/onSettled.
      return { previous } satisfies OptimisticContext<TQueryData>;
    },
    onError(_error, _variables, context) {
      // Roll back to the snapshot captured in onMutate.
      const snapshot = context as OptimisticContext<TQueryData> | undefined;
      queryClient.setQueryData(queryKey, snapshot?.previous);
    },
    onSettled() {
      if (invalidate) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  };
}
