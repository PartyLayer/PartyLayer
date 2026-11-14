import type { TokenLock } from './token-holdings';
import type { TokenInstrumentId } from './transfer';

/** Framework-free TransferInstructionV1 wire records, shared with the React query hooks. */
export interface TokenTransferV1 {
  sender: string;
  receiver: string;
  amount: string;
  instrumentId: TokenInstrumentId;
  lock?: TokenLock;
  requestedAt: string;
  executeBefore: string;
  inputHoldingCids: string[];
  meta?: Record<string, string>;
}

export type TokenTransferInstructionV1Status =
  | { kind: 'pendingReceiverAcceptance' }
  | { kind: 'pendingInternalWorkflow'; pendingActions: Record<string, string> };

export interface TokenTransferInstructionV1 {
  originalInstructionCid?: string;
  transfer: TokenTransferV1;
  status: TokenTransferInstructionV1Status;
  meta?: Record<string, string>;
}

export interface TokenTransferInstructionV1Ref {
  cid: string;
  instruction: TokenTransferInstructionV1;
}
