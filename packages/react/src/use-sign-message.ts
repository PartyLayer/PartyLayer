'use client';

/**
 * @partylayer/react v2: useSignMessage (TanStack Query mutation).
 *
 * Wagmi-shaped: wraps the existing client sign path in `useMutation`. The
 * underlying logic is UNCHANGED: `mutationFn` calls `client.signMessage(params)`
 * (the same method the v1 context hook calls). The QueryClient is supplied by the
 * CONSUMER's `QueryClientProvider` (TanStack Query is a peer dependency).
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `signMessage`      === `mutate`      (fire-and-forget)
 *   - `signMessageAsync` === `mutateAsync` (returns Promise<SignedMessage>; throws on error)
 * (Note: v1's `signMessage` returned `Promise<SignedMessage | null>` and swallowed
 * errors into `error` state; the v1 hook on the main entrypoint is preserved.)
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import type { SignMessageParams, SignedMessage } from '@partylayer/sdk';
import { usePartyLayer } from './hooks';
import { partyLayerKeys } from './query-keys';

export interface UseSignMessageParameters {
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   * Optimistic updates: `onMutate`/`onError`/`onSettled` pass through here. See
   * docs/react-optimistic-updates.md (and the `optimisticMutationOptions` helper).
   */
  mutation?: Omit<
    UseMutationOptions<SignedMessage, Error, SignMessageParams>,
    'mutationFn' | 'mutationKey'
  >;
}

export type UseSignMessageReturnType = UseMutationResult<SignedMessage, Error, SignMessageParams> & {
  /** Sign a message (fire-and-forget). Alias of `mutate`. */
  signMessage: UseMutationResult<SignedMessage, Error, SignMessageParams>['mutate'];
  /** Sign a message and await the signature (throws on error). Alias of `mutateAsync`. */
  signMessageAsync: UseMutationResult<SignedMessage, Error, SignMessageParams>['mutateAsync'];
};

export function useSignMessage(parameters: UseSignMessageParameters = {}): UseSignMessageReturnType {
  const client = usePartyLayer();

  const mutation = useMutation<SignedMessage, Error, SignMessageParams>({
    ...parameters.mutation,
    mutationKey: partyLayerKeys.signMessage(),
    // Underlying sign path is UNCHANGED, same call the v1 hook makes.
    mutationFn: (params) => client.signMessage(params),
  });

  return {
    ...mutation,
    signMessage: mutation.mutate,
    signMessageAsync: mutation.mutateAsync,
  };
}
