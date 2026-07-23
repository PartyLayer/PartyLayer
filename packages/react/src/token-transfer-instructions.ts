'use client';

/**
 * @partylayer/react v2: useTransferInstructions (TanStack Query query).
 *
 * A CIP-0056 (Canton Token Standard) typed READ hook for pending transfer
 * instructions, mirroring `useTokenHoldings` for the `TransferInstructionView`.
 * It is the read-side sibling of the transfer write hooks
 * (`useTransferInstruction` initiates, `useTransferInstructionAction` completes):
 * this reads the instructions a party could act on. Model 2: the dApp supplies its
 * OWN read fetcher (an ACS query for `TransferInstruction` contracts, mapped to the
 * typed view), and the hook wraps it in `useQuery` and keys it.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like `useTokenHoldings`, this
 * hook does **not** touch the PartyLayer client, does not call `usePartyLayer`, and
 * does not reach any ledger/validator itself. The dApp supplies its own
 * instructions-read fetcher, typically an active-contracts query filtered to the
 * token-standard transfer-instruction interface, mapped into
 * {@link TokenTransferInstructionRef}[].
 *
 * `read` may resolve `null`: a party may have no pending instructions, a successful
 * result, not an error. So the data is `TokenTransferInstructionRef[] | null`, and
 * `instructions` may be `null`.
 *
 * Example of a dApp `read` (stays in the dApp, NOT in the hook):
 *
 *   const read = async (signal) => {
 *     const acs = await fetchActiveContracts(
 *       { interfaceId: 'Splice.Api.Token.TransferInstructionV1:TransferInstruction', party },
 *       signal,
 *     );
 *     return acs.map((c) => ({
 *       cid: c.contractId, // feeds TransferInstructionActionRequest.instructionCid
 *       instruction: {
 *         originalInstructionCid: c.view.originalInstructionCid ?? undefined,
 *         transfer: c.view.transfer,
 *         status: c.view.status,
 *         meta: c.view.meta ?? undefined,
 *       },
 *     }));
 *   };
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { partyLayerKeys } from './query-keys';
import type { TokenTransfer } from './transfer-instruction';

/**
 * The lifecycle status of a transfer instruction. Mirrors the Daml
 * `TransferInstructionStatus` view variants from
 * `Splice.Api.Token.TransferInstructionV1` (Canton Token Standard, Apache-2.0):
 *   - `pendingReceiverAcceptance` maps to `TransferPendingReceiverAcceptance`: the
 *     receiver has not yet accepted. `TransferInstruction_Accept` and
 *     `TransferInstruction_Reject` are ONLY available in this state.
 *   - `pendingInternalWorkflow` maps to `TransferPendingInternalWorkflow`, which
 *     carries `pendingActions : Map Party Text`, informing wallet users which party
 *     could act to advance the transfer.
 *
 * Distinct from `TransferInstructionResultStatus` (in `./transfer-instruction`),
 * which is the RESULT of exercising a transfer choice, not the instruction's
 * lifecycle status.
 */
export type TokenTransferInstructionStatus =
  | { kind: 'pendingReceiverAcceptance' }
  | { kind: 'pendingInternalWorkflow'; pendingActions: Record<string, string> };

/**
 * A pending transfer instruction. Mirrors `TransferInstructionView` from
 * `Splice.Api.Token.TransferInstructionV1` exactly (four fields). Reuses
 * {@link TokenTransfer} from the transfer write hook.
 */
export interface TokenTransferInstruction {
  /**
   * The instruction this one supersedes, when the registry evolves an instruction
   * in multiple steps (Daml `Optional (ContractId TransferInstruction)`). Only set
   * to track lineage; absent otherwise.
   */
  originalInstructionCid?: string;
  /** The transfer this instruction is executing. */
  transfer: TokenTransfer;
  /** The instruction's lifecycle status. */
  status: TokenTransferInstructionStatus;
  /** Free-form metadata, a string-to-string map (Daml `Metadata`). */
  meta?: Record<string, string>;
}

/**
 * A transfer instruction as an ACS query returns it: a contract id paired with its
 * interface view. The `cid` feeds `TransferInstructionActionRequest.instructionCid`;
 * the `instruction` stays a byte-exact `TransferInstructionView` mirror.
 */
export interface TokenTransferInstructionRef {
  /** The instruction contract's id (Daml `ContractId TransferInstruction`). */
  cid: string;
  /** The standard transfer-instruction view. */
  instruction: TokenTransferInstruction;
}

export interface UseTransferInstructionsParameters {
  /**
   * The dApp's instructions-read fetcher. Queries the dApp's own validator/ledger
   * for the party's CIP-0056 transfer-instruction contracts and resolves them
   * mapped into {@link TokenTransferInstructionRef}[] (each a `{ cid, instruction }`
   * pair), or `null` when there are none yet / the read is absent (a successful
   * result). Receives the query's `AbortSignal` so the dApp can cancel in-flight
   * requests.
   */
  read: (signal?: AbortSignal) => Promise<TokenTransferInstructionRef[] | null>;
  /**
   * Opaque identifier for the instructions query being read (e.g. the party and any
   * filter the dApp keys on). Folded into the queryKey so different reads cache
   * independently. Does not need to be forwarded to `read` (the dApp's fetcher
   * already closes over its query).
   *
   * INVALIDATION: the hook namespaces this key as
   * `partyLayerKeys.transferInstructions({ key })`; the raw `key` is NOT the
   * queryKey, so prefix-invalidating with the raw `key` silently matches nothing.
   * Invalidate with
   * `queryClient.invalidateQueries({ queryKey: partyLayerKeys.transferInstructions() })`
   * for every instance, or `({ key: yourKey })` for one.
   */
  key?: unknown;
  /**
   * Pass-through TanStack `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the hook and cannot be overridden.
   */
  query?: Omit<
    UseQueryOptions<TokenTransferInstructionRef[] | null, Error>,
    'queryKey' | 'queryFn'
  >;
}

export type UseTransferInstructionsReturnType = UseQueryResult<
  TokenTransferInstructionRef[] | null,
  Error
> & {
  /**
   * The instructions (alias of `data`), each a `{ cid, instruction }` ref.
   * `undefined` until loaded; `null` when there are none yet / the read is absent
   * (a successful result, not an error).
   */
  instructions: TokenTransferInstructionRef[] | null | undefined;
};

export function useTransferInstructions(
  parameters: UseTransferInstructionsParameters,
): UseTransferInstructionsReturnType {
  const { read, key, query } = parameters;

  const result = useQuery<TokenTransferInstructionRef[] | null, Error>({
    ...query,
    queryKey: partyLayerKeys.transferInstructions({ key }),
    // queryFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    queryFn: ({ signal }) => read(signal),
  });

  return {
    ...result,
    instructions: result.data,
  };
}
