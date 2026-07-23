'use client';

/**
 * @partylayer/react v2: useTransferInstructionAction (TanStack Query mutation).
 *
 * The completion sibling of `useTransferInstruction`: where that hook INITIATES a
 * transfer (`TransferFactory_Transfer`), this one COMPLETES a pending
 * TransferInstruction contract by exercising one of the standard CIP-0056
 * (Canton Token Standard) completion choices. Scope: transfer completion only.
 *
 * The three standard completion choices on a `TransferInstruction` contract and
 * their controllers:
 *   - `TransferInstruction_Accept`   the receiver accepts the transfer;
 *   - `TransferInstruction_Reject`   the receiver rejects it (only available while
 *                                    the instruction is pending receiver
 *                                    acceptance);
 *   - `TransferInstruction_Withdraw` the sender withdraws it.
 *
 * `TransferInstruction_Update` is deliberately EXCLUDED: it is the registry's
 * internal workflow choice, not a wallet-user action.
 *
 * Each of the three choices takes ONLY `extraArgs` (a `{ context, meta }` pair):
 * the `context` comes from the registry's off-ledger Token Standard API (it cannot
 * easily be obtained from the ledger), alongside the `disclosedContracts`; `meta`
 * is app-level metadata. The execution is a non-factory interface exercise:
 * `templateId` = the TransferInstruction interface id
 * (`#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction`),
 * `contractId` = the instruction's contract id, `choice` = one of the three names,
 * `choiceArgument` = `{ extraArgs }`, submitted with the registry's
 * `disclosedContracts`.
 *
 * MODEL 2: a completion is a ledger write, which under Model 2 the dApp owns. Like
 * `useTransferInstruction`, this hook does **not** touch the PartyLayer client,
 * does not call `usePartyLayer`, and does not reach any ledger itself. The
 * registry context fetch, the `disclosedContracts`, and the command submission are
 * registry-specific and off-ledger, so PartyLayer cannot and must not model them.
 * The dApp supplies its OWN submit fetcher; the hook only types the request and
 * wraps it in `useMutation` and keys it.
 *
 * Example of a dApp `submit` (stays in the dApp, NOT in the hook):
 *
 *   const submit = async (request, signal) => {
 *     const choice =
 *       request.action === 'accept' ? 'TransferInstruction_Accept'
 *         : request.action === 'reject' ? 'TransferInstruction_Reject'
 *         : 'TransferInstruction_Withdraw';
 *     const ctx = await registry.getTransferInstructionChoiceContext(
 *       { instructionCid: request.instructionCid, action: request.action },
 *       signal,
 *     );
 *     return submitExercise({
 *       templateId: '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction',
 *       contractId: request.instructionCid,
 *       choice,
 *       choiceArgument: { extraArgs: { context: ctx.choiceContext, meta: request.meta ?? {} } },
 *       disclosedContracts: ctx.disclosedContracts,
 *     }, signal);
 *   };
 *
 * For interpreting the result, the standard `TransferInstructionResult` output
 * variants map to {@link TransferInstructionResultStatus} (`pending | completed |
 * failed`), already exported from `./transfer-instruction`. The concrete result
 * shape is the dApp's, so `R` stays generic (default `unknown`), exactly like
 * `useTransferInstruction`.
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
 * Which standard completion choice to exercise on a `TransferInstruction`.
 * Maps to `TransferInstruction_Accept` / `TransferInstruction_Reject` /
 * `TransferInstruction_Withdraw`. `accept` and `reject` are the RECEIVER's
 * actions; `withdraw` is the SENDER's. `reject` is only available while the
 * instruction is pending receiver acceptance. The registry's internal
 * `TransferInstruction_Update` choice is deliberately not a member: it is not a
 * wallet-user action.
 */
export type TransferInstructionActionKind = 'accept' | 'reject' | 'withdraw';

export interface TransferInstructionActionRequest {
  /** Contract id of the `TransferInstruction` being acted on. */
  instructionCid: string;
  /** Which standard completion choice to exercise. */
  action: TransferInstructionActionKind;
  /**
   * Optional app-level metadata. Maps to `extraArgs.meta`; the registry-provided
   * choice context goes into `extraArgs.context`, filled by the dApp's fetcher.
   */
  meta?: Record<string, string>;
}

export interface UseTransferInstructionActionParameters<R = unknown> {
  /**
   * The dApp's submit fetcher. Receives the typed
   * {@link TransferInstructionActionRequest} and performs the FULL
   * registry-specific flow the standard does not standardize: find the instruction,
   * fetch the off-ledger choice context for the chosen action from the registry's
   * transfer-instruction API, fill `extraArgs`, and exercise the choice with the
   * registry's `disclosedContracts`. Resolves the dApp's result (`R`). The `signal`
   * is optional and reserved for the dApp's own cancellation: TanStack mutations do
   * not provide an AbortSignal to `mutationFn`, so the hook calls this with the
   * request only.
   */
  submit: (request: TransferInstructionActionRequest, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   */
  mutation?: Omit<UseMutationOptions<R, Error, TransferInstructionActionRequest>, 'mutationFn' | 'mutationKey'>;
}

export type UseTransferInstructionActionReturnType<R = unknown> = UseMutationResult<R, Error, TransferInstructionActionRequest> & {
  /** Exercise the chosen completion choice (fire-and-forget). Alias of `mutate`. */
  submitAction: UseMutationResult<R, Error, TransferInstructionActionRequest>['mutate'];
  /** Exercise and await the result (throws on error). Alias of `mutateAsync`. */
  submitActionAsync: UseMutationResult<R, Error, TransferInstructionActionRequest>['mutateAsync'];
};

export function useTransferInstructionAction<R = unknown>(
  parameters: UseTransferInstructionActionParameters<R>,
): UseTransferInstructionActionReturnType<R> {
  const { submit, mutation } = parameters;

  const result = useMutation<R, Error, TransferInstructionActionRequest>({
    ...mutation,
    mutationKey: partyLayerKeys.transferInstructionAction(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    mutationFn: (request) => submit(request),
  });

  return {
    ...result,
    submitAction: result.mutate,
    submitActionAsync: result.mutateAsync,
  };
}
