'use client';

/**
 * @partylayer/react v2: useChoice (TanStack Query mutation).
 *
 * The write-side analog of wagmi's `useWriteContract`, and the WRITE counterpart to
 * `useDamlContract` (the read hook). It exercises a DAML choice through a
 * dApp-supplied fetcher and wraps it in `useMutation`.
 *
 * MODEL 2: a choice exercise is a ledger write, which under Model 2 the dApp owns.
 * Like `useDamlContract`, this hook does **not** touch the PartyLayer client, does
 * not call `usePartyLayer`, and does not reach any ledger itself. The dApp supplies
 * its OWN exercise fetcher, typically a command submission to its validator's
 * ledger API, and this hook only wraps it in `useMutation` and keys it.
 *
 * DISTINCT FROM useSubmitTransaction: `useSubmitTransaction` DOES use the PartyLayer
 * client, because submitting a wallet transaction is PartyLayer's job. `useChoice`
 * is the mutation twin of `useDamlContract`: a dApp-supplied fetcher, schema-
 * agnostic, no PartyLayer client. It borrows the mutation mechanics
 * (mutate/mutateAsync aliases, mutationKey, pass-through options) but not the
 * client.
 *
 * SCHEMA-AGNOSTIC: PartyLayer does not know the dApp's DAML schema, so the hook is
 * GENERIC over `R` (the exercise result) and `V` (the exercise variables: which
 * choice, what arguments, all dApp-defined and opaque to PartyLayer). It does not
 * model templateId/choiceName/choiceArgument; the dApp's fetcher closes over the
 * real exercise.
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `exerciseChoice`      === `mutate`      (fire-and-forget)
 *   - `exerciseChoiceAsync` === `mutateAsync` (returns Promise<R>; throws on error)
 *
 * The QueryClient is supplied by the CONSUMER's `QueryClientProvider` (TanStack
 * Query is a peer dependency).
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';

export interface UseChoiceParameters<R, V> {
  /**
   * The dApp's exercise fetcher. Receives the exercise variables (the choice and
   * its arguments, dApp-defined) and resolves the exercise result. The `signal`
   * is optional and reserved for the dApp's own cancellation: TanStack mutations
   * do not provide an AbortSignal to `mutationFn`, so the hook calls this with the
   * variables only.
   */
  exercise: (variables: V, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   * Optimistic updates: `onMutate`/`onError`/`onSettled` pass through here. See
   * docs/react-optimistic-updates.md (and the `optimisticMutationOptions` helper).
   */
  mutation?: Omit<UseMutationOptions<R, Error, V>, 'mutationFn' | 'mutationKey'>;
}

export type UseChoiceReturnType<R, V> = UseMutationResult<R, Error, V> & {
  /** Exercise the choice (fire-and-forget). Alias of `mutate`. */
  exerciseChoice: UseMutationResult<R, Error, V>['mutate'];
  /** Exercise the choice and await the result (throws on error). Alias of `mutateAsync`. */
  exerciseChoiceAsync: UseMutationResult<R, Error, V>['mutateAsync'];
};

export function useChoice<R, V>(
  parameters: UseChoiceParameters<R, V>,
): UseChoiceReturnType<R, V> {
  const { exercise, mutation } = parameters;

  const result = useMutation<R, Error, V>({
    ...mutation,
    mutationKey: partyLayerKeys.exerciseChoice(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    mutationFn: (variables) => exercise(variables),
  });

  return {
    ...result,
    exerciseChoice: result.mutate,
    exerciseChoiceAsync: result.mutateAsync,
  };
}
