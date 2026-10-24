'use client';

/**
 * @partylayer/react v2: useAllocationAction (TanStack Query mutation).
 *
 * The action sibling of `useTransferInstructionAction`, over a funded CIP-0056
 * `Allocation` contract. It exercises one of the standard choices that act on an
 * allocation. Scope: funded-allocation actions only.
 *
 * The three standard choices on an `Allocation` contract and their semantics
 * (each takes ONLY `extraArgs`):
 *   - `Allocation_ExecuteTransfer` executes the actual transfer of the allocated
 *     assets. Controller: the allocation controllers (sender, receiver, and
 *     executor); typically the sender and receiver delegate to the executor via
 *     the settlement contract, so the settlement app triggers it. SHOULD succeed
 *     before `settlement.settleBefore`. FUND SAFETY: this moves the actual assets
 *     of the settlement leg.
 *   - `Allocation_Cancel` releases the allocated assets early when the settlement
 *     is aborted or has definitely failed. Controller: the allocation controllers.
 *   - `Allocation_Withdraw` withdraws the allocated assets before settlement
 *     completes. Controller: the SENDER. SHOULD not fail the settlement if the
 *     sender still has time to re-allocate (before `settlement.allocateBefore`).
 *
 * Deliberately EXCLUDED:
 *   - `AllocationInstruction_Update`: the registry's internal workflow choice
 *     (controller: the instrument admin plus extra actors), not a wallet-user
 *     action.
 *   - `AllocationInstruction_Withdraw`: withdrawing a PENDING `AllocationInstruction`
 *     is a real sender action, but it targets the `AllocationInstruction` interface,
 *     a DIFFERENT contract than the funded `Allocation` this hook acts on. Mixing
 *     the two contract-id semantics in one hook would be confusing. A dApp can use
 *     the generic `useChoice` for it today; a typed variant may follow later.
 *
 * MODEL 2: an allocation action is a ledger write, which under Model 2 the dApp
 * owns. Like `useTransferInstructionAction`, this hook does **not** touch the
 * PartyLayer client, does not call `usePartyLayer`, and does not reach any ledger
 * itself. Each choice's `extraArgs.context` comes from the registry's off-ledger
 * Token Standard API, alongside the `disclosedContracts`, so PartyLayer cannot and
 * must not model them. The dApp supplies its OWN submit fetcher; the hook only
 * types the request and wraps it in `useMutation` and keys it.
 *
 * Example of a dApp `submit` (stays in the dApp, NOT in the hook):
 *
 *   const submit = async (request, signal) => {
 *     const choice =
 *       request.action === 'executeTransfer' ? 'Allocation_ExecuteTransfer'
 *         : request.action === 'cancel' ? 'Allocation_Cancel'
 *         : 'Allocation_Withdraw';
 *     const ctx = await registry.getAllocationChoiceContext(
 *       { allocationCid: request.allocationCid, action: request.action },
 *       signal,
 *     );
 *     return submitExercise({
 *       contractId: request.allocationCid,
 *       choice,
 *       choiceArgument: { extraArgs: { context: ctx.choiceContext, meta: request.meta ?? {} } },
 *       disclosedContracts: ctx.disclosedContracts,
 *     }, signal);
 *   };
 *
 * The result stays generic `R` (the dApp's submit pipeline shape), exactly like
 * `useTransferInstructionAction`.
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
 * Which standard choice to exercise on a funded `Allocation`. Maps to
 * `Allocation_ExecuteTransfer` / `Allocation_Cancel` / `Allocation_Withdraw`.
 * `executeTransfer` moves the actual assets (typically executor-triggered),
 * `cancel` releases them on settlement abort/failure, and `withdraw` is the
 * sender's early release before settlement completes. The instruction-level
 * `AllocationInstruction_Update` and `AllocationInstruction_Withdraw` are not
 * members: the former is registry-internal, the latter targets the different
 * `AllocationInstruction` contract (see the hook doc).
 */
export type AllocationActionKind = 'executeTransfer' | 'cancel' | 'withdraw';

export interface AllocationActionRequest {
  /** Contract id of the funded `Allocation` being acted on (NOT an `AllocationInstruction` cid). */
  allocationCid: string;
  /** Which standard choice to exercise. */
  action: AllocationActionKind;
  /**
   * Optional app-level metadata. Maps to `extraArgs.meta`; the registry-provided
   * choice context goes into `extraArgs.context`, filled by the dApp's fetcher.
   */
  meta?: Record<string, string>;
}

export interface UseAllocationActionParameters<R = unknown> {
  /**
   * The dApp's submit fetcher. Receives the typed {@link AllocationActionRequest}
   * and performs the FULL registry-specific flow the standard does not
   * standardize: fetch the off-ledger choice context for the chosen action from
   * the registry, fill `extraArgs`, and exercise the choice on the `Allocation`
   * with the registry's `disclosedContracts`. Resolves the dApp's result (`R`).
   * The `signal` is optional and reserved for the dApp's own cancellation: TanStack
   * mutations do not provide an AbortSignal to `mutationFn`, so the hook calls this
   * with the request only.
   */
  submit: (request: AllocationActionRequest, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * Automatic retry is always disabled, including global/per-mutation retry settings.
   * Reconcile an unknown ledger result before an explicit new submission.
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   */
  mutation?: Omit<UseMutationOptions<R, Error, AllocationActionRequest>, 'mutationFn' | 'mutationKey'>;
}

export type UseAllocationActionReturnType<R = unknown> = UseMutationResult<R, Error, AllocationActionRequest> & {
  /** Exercise the chosen allocation choice (fire-and-forget). Alias of `mutate`. */
  submitAction: UseMutationResult<R, Error, AllocationActionRequest>['mutate'];
  /** Exercise and await the result (throws on error). Alias of `mutateAsync`. */
  submitActionAsync: UseMutationResult<R, Error, AllocationActionRequest>['mutateAsync'];
};

export function useAllocationAction<R = unknown>(
  parameters: UseAllocationActionParameters<R>,
): UseAllocationActionReturnType<R> {
  const { submit, mutation } = parameters;

  const result = useMutation<R, Error, AllocationActionRequest>({
    ...mutation,
    mutationKey: partyLayerKeys.allocationAction(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    // A lost response can follow a successful ledger write. Never replay automatically.
    retry: false,
    mutationFn: (request) => submit(request),
  });

  return {
    ...result,
    submitAction: result.mutate,
    submitActionAsync: result.mutateAsync,
  };
}
