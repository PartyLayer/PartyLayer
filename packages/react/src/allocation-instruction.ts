'use client';

/**
 * @partylayer/react v2: useAllocationInstruction (TanStack Query mutation).
 *
 * A CIP-0056 (Canton Token Standard) typed specialization of `useChoice` for the
 * AllocationInstructionV1 `AllocationFactory_Allocate` flow. It is the allocation
 * sibling of `useTransferInstruction`: where that hook creates a transfer via the
 * transfer factory, this one CREATES an allocation via the allocation factory.
 * The controller is the transfer leg's sender; the choice returns an
 * `AllocationInstructionResult`.
 *
 * An allocation earmarks (locks) a sender's holdings to fund one leg of a
 * settlement, so the settlement's executor can later move the assets. Depending on
 * the registry, exercising the factory creates the `Allocation` directly or an
 * `AllocationInstruction` first.
 *
 * MODEL 2: creating an allocation is a ledger write, which under Model 2 the dApp
 * owns. Like `useTransferInstruction`, this hook does **not** touch the PartyLayer
 * client, does not call `usePartyLayer`, and does not reach any ledger itself. The
 * registry factory fetch, the `choiceContext`, the `disclosedContracts`, and the
 * command submission are registry-specific and off-ledger, so PartyLayer cannot
 * and must not model them. The dApp supplies its OWN submit fetcher; the hook only
 * types the request and wraps it in `useMutation` and keys it.
 *
 * The registry flow mirrors the transfer factory: POST the registry's
 * allocation-instruction endpoint
 * (`/registry/allocation-instruction/v1/allocation-factory`) to get the
 * `factoryId`, `choiceContext`, and `disclosedContracts`; fill
 * `extraArgs.context`; exercise `AllocationFactory_Allocate` on the factory with
 * the `disclosedContracts`.
 *
 * Example of a dApp `submit` (stays in the dApp, NOT in the hook):
 *
 *   const submit = async (request, signal) => {
 *     const factory = await registry.getAllocationFactory(
 *       { allocation: request.allocation, expectedAdmin: request.expectedAdmin },
 *       signal,
 *     );
 *     return submitExercise({
 *       factoryId: factory.factoryId,
 *       choice: 'AllocationFactory_Allocate',
 *       choiceArgs: {
 *         expectedAdmin: request.expectedAdmin,
 *         allocation: request.allocation,
 *         requestedAt: request.requestedAt,
 *         inputHoldingCids: request.inputHoldingCids,
 *         extraArgs: { context: factory.choiceContext, meta: request.meta ?? {} },
 *       },
 *       disclosedContracts: factory.disclosedContracts,
 *     }, signal);
 *   };
 *
 * The Daml result is `AllocationInstructionResult` (its `output`, plus
 * `senderChangeCids` and `meta`), but the dApp's submit pipeline shape is its own,
 * so `R` stays generic (default `unknown`), exactly like `useTransferInstruction`.
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `submitAllocation`      === `mutate`      (fire-and-forget)
 *   - `submitAllocationAsync` === `mutateAsync` (returns Promise<R>; throws on error)
 *
 * The QueryClient is supplied by the CONSUMER's `QueryClientProvider`.
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';
import type { TokenAllocationSpecification } from './token-allocations';

export interface AllocationInstructionRequest {
  /**
   * The expected admin party issuing the factory. SECURITY: obtain this from a
   * trusted source (e.g. a read against your own participant), per the standard,
   * so that a factory acquired from an untrusted source is safe to exercise. The
   * choice checks the factory's admin against this value.
   */
  expectedAdmin: string;
  /** The allocation to create (settlement, transferLegId, transferLeg). Reused type. */
  allocation: TokenAllocationSpecification;
  /** Time the allocation was requested, an ISO 8601 timestamp (Daml `Time`). */
  requestedAt: string;
  /**
   * Holdings that SHOULD fund the allocation (Daml `[ContractId Holding]`). MAY be
   * empty for registries with off-ledger holdings or automatic selection. If
   * specified, a successful allocation archives all of them, so execution
   * conflicts with any other allocation using the same holdings: the sender can
   * use deliberate contention on holdings to prevent duplicate allocations.
   */
  inputHoldingCids: string[];
  /**
   * Optional app-level metadata. Maps to `extraArgs.meta`; the registry-provided
   * choice context goes into `extraArgs.context`, filled by the dApp's fetcher.
   */
  meta?: Record<string, string>;
}

export interface UseAllocationInstructionParameters<R = unknown> {
  /**
   * The dApp's submit fetcher. Receives the typed
   * {@link AllocationInstructionRequest} and performs the FULL registry-specific
   * flow the standard does not standardize: fetch the allocation factory (with the
   * `choiceContext` and `disclosedContracts`) from the registry, fill `extraArgs`,
   * and exercise `AllocationFactory_Allocate` with the registry's
   * `disclosedContracts`. Resolves the dApp's result (`R`). The `signal` is
   * optional and reserved for the dApp's own cancellation: TanStack mutations do
   * not provide an AbortSignal to `mutationFn`, so the hook calls this with the
   * request only.
   */
  submit: (request: AllocationInstructionRequest, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * Automatic retry is always disabled, including global/per-mutation retry settings.
   * Reconcile an unknown ledger result before an explicit new submission.
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   */
  mutation?: Omit<UseMutationOptions<R, Error, AllocationInstructionRequest>, 'mutationFn' | 'mutationKey'>;
}

export type UseAllocationInstructionReturnType<R = unknown> = UseMutationResult<R, Error, AllocationInstructionRequest> & {
  /** Create the allocation (fire-and-forget). Alias of `mutate`. */
  submitAllocation: UseMutationResult<R, Error, AllocationInstructionRequest>['mutate'];
  /** Create the allocation and await the result (throws on error). Alias of `mutateAsync`. */
  submitAllocationAsync: UseMutationResult<R, Error, AllocationInstructionRequest>['mutateAsync'];
};

export function useAllocationInstruction<R = unknown>(
  parameters: UseAllocationInstructionParameters<R>,
): UseAllocationInstructionReturnType<R> {
  const { submit, mutation } = parameters;

  const result = useMutation<R, Error, AllocationInstructionRequest>({
    ...mutation,
    mutationKey: partyLayerKeys.allocationInstruction(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    // A lost response can follow a successful ledger write. Never replay automatically.
    retry: false,
    mutationFn: (request) => submit(request),
  });

  return {
    ...result,
    submitAllocation: result.mutate,
    submitAllocationAsync: result.mutateAsync,
  };
}
