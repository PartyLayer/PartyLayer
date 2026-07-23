'use client';

/**
 * @partylayer/react v2: useTransferInstruction (TanStack Query mutation).
 *
 * A CIP-0056 (Canton Token Standard) typed specialization of `useChoice` for the
 * TransferInstructionV1 `TransferFactory_Transfer` flow. It is the WRITE-side
 * sibling of `useTokenHoldings`: exactly as `useTokenHoldings` is a typed
 * specialization of `useDamlContract` (read), this is a typed specialization of
 * `useChoice` (write). Scope: transfer initiation submit only.
 *
 * MODEL 2: a transfer is a ledger write, which under Model 2 the dApp owns. Like
 * `useChoice`, this hook does **not** touch the PartyLayer client, does not call
 * `usePartyLayer`, and does not reach any ledger itself. The dApp supplies its OWN
 * transfer-submit fetcher (`submit`), and this hook only wraps it in `useMutation`
 * and keys it. The only difference from `useChoice` is that the mutation variables
 * are TYPED to the standard CIP-0056 `Transfer` record ({@link TokenTransfer})
 * instead of being an opaque `V`.
 *
 * WHY THE SUBMIT STAYS WITH THE dApp: a real CIP-0056 transfer is not a single
 * ledger call, and the pieces that make it work are registry-specific and
 * off-ledger, which the standard deliberately does not standardize. Following the
 * official Splice CLI flow, the dApp's `submit` fetcher performs the full flow:
 *   1. query the sender's Holding contracts to gather `inputHoldingCids` (or the
 *      dApp passes them in on the {@link TokenTransfer});
 *   2. call the registry's `getTransferFactory` HTTP endpoint (a registry-specific
 *      OpenAPI) to get the `factoryId`, `choiceContext`, and `disclosedContracts`;
 *   3. fill `choiceArgs.extraArgs.context` with the registry's `choiceContextData`;
 *   4. submit the `TransferFactory_Transfer` exercise WITH the registry's
 *      `disclosedContracts`.
 * Steps 2 and 4 are registry-specific and off-ledger, so PartyLayer cannot and
 * must not model them; the dApp's fetcher closes over them, the same way
 * `useTokenHoldings` leaves the ACS query to the dApp.
 *
 * Example of a dApp `submit` (stays in the dApp, NOT in the hook):
 *
 *   const submit = async (transfer, signal) => {
 *     const factory = await registry.getTransferFactory(
 *       { instrumentId: transfer.instrumentId, sender: transfer.sender, receiver: transfer.receiver },
 *       signal,
 *     );
 *     return submitExercise({
 *       factoryId: factory.factoryId,
 *       choice: 'TransferFactory_Transfer',
 *       choiceArgs: { transfer, extraArgs: { context: factory.choiceContext } },
 *       disclosedContracts: factory.disclosedContracts,
 *     }, signal);
 *   };
 *
 * Returns the TanStack mutation result spread, plus wagmi-style aliases:
 *   - `submitTransfer`      === `mutate`      (fire-and-forget)
 *   - `submitTransferAsync` === `mutateAsync` (returns Promise<R>; throws on error)
 *
 * The QueryClient is supplied by the CONSUMER's `QueryClientProvider` (TanStack
 * Query is a peer dependency).
 *
 * Roadmap: accept/reject/withdraw for the two-step transfer model, and allocation,
 * are out of scope here and can land as later, separate hooks. This hook is
 * transfer initiation (`TransferFactory_Transfer`) submit only.
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';
import type { TokenInstrumentId, TokenLock } from './token-holdings';

/**
 * The standard CIP-0056 `Transfer` record passed into `TransferFactory_Transfer`.
 * Mirrors `Transfer` from `Splice.Api.Token.TransferInstructionV1` (Canton Token
 * Standard, Splice, Apache-2.0, Digital Asset). Reuses {@link TokenInstrumentId}
 * and {@link TokenLock} from the holdings hook.
 *
 * Only this record is standard and modelable. The registry fetch
 * (`getTransferFactory`), the `choiceContext`, the `disclosedContracts`, and the
 * submit itself are registry-specific and off-ledger; they are the dApp's
 * responsibility, performed inside its `submit` fetcher (see the hook doc).
 */
export interface TokenTransfer {
  /** The party sending the amount (Daml `Party`). */
  sender: string;
  /** The party receiving the amount (Daml `Party`). */
  receiver: string;
  /**
   * The amount to transfer, a decimal-as-string to preserve exact precision (Daml
   * `Decimal`). NEVER a JS `number`, which cannot represent large or precise
   * decimals losslessly.
   */
  amount: string;
  /** The instrument being transferred. Reused from the holdings hook. */
  instrumentId: TokenInstrumentId;
  /** Optional lock to apply to the resulting holding (Daml `Optional Lock`). Reused. */
  lock?: TokenLock;
  /** When the transfer was requested, an ISO 8601 timestamp (Daml `Time`). */
  requestedAt: string;
  /** Deadline by which the transfer must execute, an ISO 8601 timestamp (Daml `Time`). */
  executeBefore: string;
  /**
   * The sender's input holding contract ids to spend (Daml `[ContractId Holding]`).
   * The dApp gathers these by querying the sender's Holding contracts.
   */
  inputHoldingCids: string[];
  /** Free-form metadata, a string-to-string map (Daml `Metadata`, a `TextMap Text`). */
  meta?: Record<string, string>;
}

/**
 * The status of the RESULT of exercising a transfer choice. Mirrors the
 * `TransferInstructionResult` output constructors `Pending | Completed | Failed`
 * from the CIP-0056 spec, lowercased to match the TypeScript/PartyLayer convention
 * (like `TransactionToastStatus`). The concrete result shape is
 * implementation-specific, so it is the dApp's `R`; this string union is provided
 * for dApps that want to model the standard result status.
 *
 * Distinct from `TokenTransferInstructionStatus` (in `./token-transfer-instructions`),
 * which is the different concept of an instruction's lifecycle status (the Daml
 * `TransferInstructionStatus` view type: pending receiver acceptance vs pending
 * internal workflow).
 */
export type TransferInstructionResultStatus = 'pending' | 'completed' | 'failed';

export interface UseTransferInstructionParameters<R = unknown> {
  /**
   * The dApp's transfer-submit fetcher. Receives the typed {@link TokenTransfer}
   * and performs the FULL registry-specific flow the standard does not
   * standardize: gather `inputHoldingCids` (or the dApp passes them in on the
   * transfer), call the registry's `getTransferFactory`, fill the `choiceContext`,
   * and submit the `TransferFactory_Transfer` exercise with the registry's
   * `disclosedContracts`. Resolves the dApp's result (`R`). The `signal` is
   * optional and reserved for the dApp's own cancellation: TanStack mutations do
   * not provide an AbortSignal to `mutationFn`, so the hook calls this with the
   * transfer only.
   */
  submit: (transfer: TokenTransfer, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through TanStack `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the hook and cannot be overridden.
   */
  mutation?: Omit<UseMutationOptions<R, Error, TokenTransfer>, 'mutationFn' | 'mutationKey'>;
}

export type UseTransferInstructionReturnType<R = unknown> = UseMutationResult<R, Error, TokenTransfer> & {
  /** Submit the transfer (fire-and-forget). Alias of `mutate`. */
  submitTransfer: UseMutationResult<R, Error, TokenTransfer>['mutate'];
  /** Submit the transfer and await the result (throws on error). Alias of `mutateAsync`. */
  submitTransferAsync: UseMutationResult<R, Error, TokenTransfer>['mutateAsync'];
};

export function useTransferInstruction<R = unknown>(
  parameters: UseTransferInstructionParameters<R>,
): UseTransferInstructionReturnType<R> {
  const { submit, mutation } = parameters;

  const result = useMutation<R, Error, TokenTransfer>({
    ...mutation,
    mutationKey: partyLayerKeys.transferInstruction(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    mutationFn: (transfer) => submit(transfer),
  });

  return {
    ...result,
    submitTransfer: result.mutate,
    submitTransferAsync: result.mutateAsync,
  };
}
