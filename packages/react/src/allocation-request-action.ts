'use client';

/**
 * @partylayer/react v2: useAllocationRequestAction (TanStack Query mutation).
 *
 * The action sibling of `useTransferInstructionAction`, over a CIP-0056
 * `AllocationRequest` contract. It exercises one of the two standard choices that
 * respond to a settlement app's allocation request. Scope: request response only.
 *
 * The two standard choices and their controllers (verified against
 * `Splice.Api.Token.AllocationRequestV1`):
 *   - `AllocationRequest_Reject` with `{ actor, extraArgs }`. Controller: `actor`.
 *     Implementations SHOULD allow ANY sender of a transfer leg to reject,
 *     signalling they will definitely not allocate.
 *   - `AllocationRequest_Withdraw` with `{ extraArgs }`. Controller: the
 *     settlement's `executor`. Used when the executor cannot execute, e.g. a
 *     cancelled trade.
 *
 * Both choices are called with an EMPTY choice context: the `ExtraArgs` exists only
 * for future extensibility, so NO registry context fetch is needed. The dApp's
 * `submit` fetcher exercises directly on the request cid with
 * `extraArgs { context: empty, meta }`. Both return `ChoiceExecutionMetadata`; the
 * concrete result shape is the dApp's, so `R` stays generic (default `unknown`),
 * exactly like `useTransferInstructionAction`.
 *
 * MODEL 2: responding to a request is a ledger write, which under Model 2 the dApp
 * owns. Like `useTransferInstructionAction`, this hook does **not** touch the
 * PartyLayer client, does not call `usePartyLayer`, and does not reach any ledger
 * itself. The dApp supplies its OWN submit fetcher; the hook only types the request
 * and wraps it in `useMutation` and keys it.
 *
 * Example of a dApp `submit` (stays in the dApp, NOT in the hook):
 *
 *   const submit = async (request, signal) => {
 *     const choice =
 *       request.action === 'reject' ? 'AllocationRequest_Reject' : 'AllocationRequest_Withdraw';
 *     const choiceArgument =
 *       request.action === 'reject'
 *         ? { actor: request.actor, extraArgs: { context: {}, meta: request.meta ?? {} } }
 *         : { extraArgs: { context: {}, meta: request.meta ?? {} } };
 *     return submitExercise({ contractId: request.requestCid, choice, choiceArgument }, signal);
 *   };
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `submitAction`      === `mutate`      (fire-and-forget)
 *   - `submitActionAsync` === `mutateAsync` (returns Promise<R>; throws on error)
 *
 * The QueryClient is supplied by the CONSUMER's `QueryClientProvider`.
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';

/**
 * Which standard choice to exercise on an `AllocationRequest`. Maps to
 * `AllocationRequest_Reject` / `AllocationRequest_Withdraw`. Reject is a transfer-leg
 * sender's action (carries the acting party); withdraw is the settlement executor's.
 */
export type AllocationRequestActionKind = 'reject' | 'withdraw';

/**
 * The typed request. A DISCRIMINATED union on `action`: reject carries the acting
 * party (the `actor` controller of `AllocationRequest_Reject`), withdraw does not
 * (the settlement executor is the implicit controller of `AllocationRequest_Withdraw`).
 */
export type AllocationRequestActionRequest =
  | {
      /** Contract id of the `AllocationRequest` being acted on. */
      requestCid: string;
      action: 'reject';
      /** The party rejecting (a transfer-leg sender; the choice `actor`). */
      actor: string;
      /** Optional app-level metadata. Maps to `extraArgs.meta`; the context is empty. */
      meta?: Record<string, string>;
    }
  | {
      /** Contract id of the `AllocationRequest` being acted on. */
      requestCid: string;
      action: 'withdraw';
      /** Optional app-level metadata. Maps to `extraArgs.meta`; the context is empty. */
      meta?: Record<string, string>;
    };

export interface UseAllocationRequestActionParameters<R = unknown> {
  /**
   * The dApp's submit fetcher. Receives the typed
   * {@link AllocationRequestActionRequest} and exercises the chosen response choice
   * on the request cid with an EMPTY choice context (no registry fetch needed), per
   * the standard. Resolves the dApp's result (`R`). The `signal` is optional and
   * reserved for the dApp's own cancellation: TanStack mutations do not provide an
   * AbortSignal to `mutationFn`, so the hook calls this with the request only.
   */
  submit: (request: AllocationRequestActionRequest, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   */
  mutation?: Omit<UseMutationOptions<R, Error, AllocationRequestActionRequest>, 'mutationFn' | 'mutationKey'>;
}

export type UseAllocationRequestActionReturnType<R = unknown> = UseMutationResult<
  R,
  Error,
  AllocationRequestActionRequest
> & {
  /** Exercise the chosen response choice (fire-and-forget). Alias of `mutate`. */
  submitAction: UseMutationResult<R, Error, AllocationRequestActionRequest>['mutate'];
  /** Exercise and await the result (throws on error). Alias of `mutateAsync`. */
  submitActionAsync: UseMutationResult<R, Error, AllocationRequestActionRequest>['mutateAsync'];
};

export function useAllocationRequestAction<R = unknown>(
  parameters: UseAllocationRequestActionParameters<R>,
): UseAllocationRequestActionReturnType<R> {
  const { submit, mutation } = parameters;

  const result = useMutation<R, Error, AllocationRequestActionRequest>({
    ...mutation,
    mutationKey: partyLayerKeys.allocationRequestAction(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    mutationFn: (request) => submit(request),
  });

  return {
    ...result,
    submitAction: result.mutate,
    submitActionAsync: result.mutateAsync,
  };
}
