'use client';

/**
 * @partylayer/react v2 — useConnect (TanStack Query mutation).
 *
 * Wagmi-shaped: wraps the existing client connect path in `useMutation`. The
 * underlying connect logic is UNCHANGED — `mutationFn` calls
 * `client.connect(options)` (the same method the v1 context hook calls). The
 * QueryClient is supplied by the CONSUMER's `QueryClientProvider` (TanStack
 * Query is a peer dependency); `useMutation` reads it via `useQueryClient`.
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `connect`      === `mutate`      (fire-and-forget; returns void)
 *   - `connectAsync` === `mutateAsync` (returns Promise<Session>; THROWS on error)
 * (Note: this differs from v1's `connect`, which returned `Promise<Session | null>`
 * and swallowed errors into `error` state. See the v1 hook on the main entrypoint
 * for backward compatibility during the migration window.)
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import type { ConnectOptions, Session } from '@partylayer/sdk';
import { usePartyLayer } from './hooks';
import { partyLayerKeys } from './query-keys';

/** The mutation variables: optional connect options (e.g. a target walletId). */
export type ConnectVariables = ConnectOptions | undefined;

export interface UseConnectParameters {
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`,
   * `retry`). `mutationFn` and `mutationKey` are managed by the hook and cannot
   * be overridden.
   */
  mutation?: Omit<
    UseMutationOptions<Session, Error, ConnectVariables>,
    'mutationFn' | 'mutationKey'
  >;
}

export type UseConnectReturnType = UseMutationResult<Session, Error, ConnectVariables> & {
  /** Connect a wallet (fire-and-forget). Alias of `mutate`. */
  connect: UseMutationResult<Session, Error, ConnectVariables>['mutate'];
  /** Connect a wallet and await the session (throws on error). Alias of `mutateAsync`. */
  connectAsync: UseMutationResult<Session, Error, ConnectVariables>['mutateAsync'];
};

export function useConnect(parameters: UseConnectParameters = {}): UseConnectReturnType {
  const client = usePartyLayer();

  const mutation = useMutation<Session, Error, ConnectVariables>({
    ...parameters.mutation,
    mutationKey: partyLayerKeys.connect(),
    // Underlying connect path is UNCHANGED — same call the v1 hook makes.
    mutationFn: (options) => client.connect(options),
  });

  return {
    ...mutation,
    connect: mutation.mutate,
    connectAsync: mutation.mutateAsync,
  };
}
