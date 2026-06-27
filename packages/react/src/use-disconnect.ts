'use client';

/**
 * @partylayer/react v2 — useDisconnect (TanStack Query mutation).
 *
 * Wagmi-shaped: wraps the existing client disconnect path in `useMutation`. The
 * underlying logic is UNCHANGED — `mutationFn` calls `client.disconnect()` (the
 * same method the v1 context hook calls). The QueryClient is supplied by the
 * CONSUMER's `QueryClientProvider` (TanStack Query is a peer dependency).
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `disconnect`      === `mutate`      (fire-and-forget)
 *   - `disconnectAsync` === `mutateAsync` (returns Promise<void>; throws on error)
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { usePartyLayer } from './hooks';
import { partyLayerKeys } from './query-keys';

/** Disconnect takes no variables. */
export type DisconnectVariables = void;

export interface UseDisconnectParameters {
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   * Optimistic updates: `onMutate`/`onError`/`onSettled` pass through here. See
   * docs/react-optimistic-updates.md (and the `optimisticMutationOptions` helper).
   */
  mutation?: Omit<
    UseMutationOptions<void, Error, DisconnectVariables>,
    'mutationFn' | 'mutationKey'
  >;
}

export type UseDisconnectReturnType = UseMutationResult<void, Error, DisconnectVariables> & {
  /** Disconnect the active session (fire-and-forget). Alias of `mutate`. */
  disconnect: UseMutationResult<void, Error, DisconnectVariables>['mutate'];
  /** Disconnect and await completion (throws on error). Alias of `mutateAsync`. */
  disconnectAsync: UseMutationResult<void, Error, DisconnectVariables>['mutateAsync'];
};

export function useDisconnect(parameters: UseDisconnectParameters = {}): UseDisconnectReturnType {
  const client = usePartyLayer();

  const mutation = useMutation<void, Error, DisconnectVariables>({
    ...parameters.mutation,
    mutationKey: partyLayerKeys.disconnect(),
    // Underlying disconnect path is UNCHANGED — same call the v1 hook makes.
    mutationFn: () => client.disconnect(),
  });

  return {
    ...mutation,
    disconnect: mutation.mutate,
    disconnectAsync: mutation.mutateAsync,
  };
}
