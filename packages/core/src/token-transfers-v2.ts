import type { TokenAccount } from './token-accounts';
import type { TokenInstrumentId } from './transfer';

/** TransferInstructionV2 Transfer. V1's party-only transfer remains unchanged. */
export interface TokenTransferV2 {
  sender: TokenAccount;
  receiver: TokenAccount;
  amount: string;
  instrumentId: TokenInstrumentId;
  requestedAt: string;
  executeBefore: string;
  inputHoldingCids: string[];
  meta?: Record<string, string>;
}

export type TokenTransferV2Action =
  | { tag: 'TIA_Accept' | 'TIA_Reject' | 'TIA_Withdraw'; value: Record<string, never> }
  | { tag: 'TIA_Custom'; value: { id: string } };

/** Daml GenMap JSON encoding. Each inner group requires joint authorization. */
export type TokenTransferV2AvailableActions = [TokenTransferV2Action, string[][]][];

export interface TokenTransferInstructionV2 {
  originalInstructionCid?: string;
  transfer: TokenTransferV2;
  expiresAt?: string;
  availableActions: TokenTransferV2AvailableActions;
  meta?: Record<string, string>;
}

export interface TokenTransferInstructionV2Ref {
  cid: string;
  instruction: TokenTransferInstructionV2;
}

export interface TokenTransferV2Result {
  output:
    | { tag: 'TransferInstructionResult_Pending'; value: { transferInstructionCid: string } }
    | { tag: 'TransferInstructionResult_Completed'; value: { receiverHoldingCids: string[] } }
    | { tag: 'TransferInstructionResult_Failed'; value: Record<string, never> };
  senderChangeCids: string[];
  meta?: Record<string, string>;
}

/**
 * UI eligibility only, never an authorization grant. Use actual authorized
 * actors, not account providers inferred from visibility. The registry remains
 * authoritative and must validate actors/delegations at execution time.
 */
export function availableTokenTransferV2Actions(
  availableActions: TokenTransferV2AvailableActions, authorizedActors: readonly string[],
): TokenTransferV2Action[] {
  const actors = new Set(authorizedActors);
  if (!actors.size || [...actors].some(party => typeof party !== 'string' || !party.trim())) return [];
  if (!Array.isArray(availableActions) || availableActions.some(entry =>
    !Array.isArray(entry) || entry.length !== 2 || !entry[0] ||
    !['TIA_Accept', 'TIA_Reject', 'TIA_Withdraw', 'TIA_Custom'].includes(entry[0].tag) ||
    !Array.isArray(entry[1]) || entry[1].some(group => !Array.isArray(group) ||
      group.some(party => typeof party !== 'string' || !party.trim())),
  )) return [];
  return availableActions.filter(([, groups]) => groups.some(group =>
    group.length > 0 && group.every(party => actors.has(party)),
  )).map(([action]) => action);
}
