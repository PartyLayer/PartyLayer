/**
 * The wire contract: the CIP-0056 ref shapes and request types the two verticals'
 * backend interfaces already speak. Declared locally so the gateway is a portable,
 * self-contained service (no monorepo package imports), byte-matching the shapes
 * published by @partylayer/react 2.2.1. Amounts are decimal strings end to end.
 */

export interface TokenInstrumentId {
  admin: string;
  id: string;
}
export interface TokenLock {
  holders: string[];
  expiresAt?: string;
  expiresAfter?: string;
  context?: string;
}
export interface TokenHolding {
  owner: string;
  instrumentId: TokenInstrumentId;
  amount: string;
  lock?: TokenLock;
  meta?: Record<string, string>;
}
export interface TokenHoldingRef {
  cid: string;
  holding: TokenHolding;
}

export interface TokenTransfer {
  sender: string;
  receiver: string;
  amount: string;
  instrumentId: TokenInstrumentId;
  requestedAt: string;
  executeBefore: string;
  inputHoldingCids: string[];
  meta?: Record<string, string>;
}
export type TransferInstructionResultStatus = 'pending' | 'completed' | 'failed';
export type TokenTransferInstructionStatus =
  | { kind: 'pendingReceiverAcceptance' }
  | { kind: 'pendingInternalWorkflow'; pendingActions: Record<string, string> };
export interface TokenTransferInstruction {
  originalInstructionCid?: string;
  transfer: TokenTransfer;
  status: TokenTransferInstructionStatus;
  meta?: Record<string, string>;
}
export interface TokenTransferInstructionRef {
  cid: string;
  instruction: TokenTransferInstruction;
}
export type TransferInstructionActionKind = 'accept' | 'reject' | 'withdraw';
export interface TransferInstructionActionRequest {
  instructionCid: string;
  action: TransferInstructionActionKind;
  meta?: Record<string, string>;
}

export interface TokenTransferLeg {
  sender: string;
  receiver: string;
  amount: string;
  instrumentId: TokenInstrumentId;
  meta?: Record<string, string>;
}
export interface TokenSettlementReference {
  id: string;
  cid?: string;
}
export interface TokenSettlementInfo {
  executor: string;
  settlementRef: TokenSettlementReference;
  requestedAt: string;
  allocateBefore: string;
  settleBefore: string;
  meta?: Record<string, string>;
}
export interface TokenAllocationSpecification {
  settlement: TokenSettlementInfo;
  transferLegId: string;
  transferLeg: TokenTransferLeg;
}
export interface TokenAllocation {
  allocation: TokenAllocationSpecification;
  holdingCids: string[];
  meta?: Record<string, string>;
}
export interface TokenAllocationRef {
  cid: string;
  allocation: TokenAllocation;
}
export interface AllocationInstructionRequest {
  expectedAdmin: string;
  allocation: TokenAllocationSpecification;
  requestedAt: string;
  inputHoldingCids: string[];
  meta?: Record<string, string>;
}
export type AllocationActionKind = 'executeTransfer' | 'cancel' | 'withdraw';
export interface AllocationActionRequest {
  allocationCid: string;
  action: AllocationActionKind;
  meta?: Record<string, string>;
}

export interface TokenAllocationRequest {
  settlement: TokenSettlementInfo;
  transferLegs: Record<string, TokenTransferLeg>;
  meta?: Record<string, string>;
}
export interface TokenAllocationRequestRef {
  cid: string;
  request: TokenAllocationRequest;
}
export type AllocationRequestActionKind = 'reject' | 'withdraw';
export type AllocationRequestActionRequest =
  | { requestCid: string; action: 'reject'; actor: string; meta?: Record<string, string> }
  | { requestCid: string; action: 'withdraw'; meta?: Record<string, string> };

/** App-local request shapes (from the verticals' lib/types and backend). */
export interface InstrumentConfig {
  admin: string;
  id: string;
  name: string;
  description?: string;
}
export type IssuerChoice =
  | { kind: 'mint'; toParty: string; amount: string }
  | { kind: 'setFrozen'; party: string; cid: string; frozen: boolean };
export interface SettleTrade {
  requestCid: string;
}
export interface CreateTrade {
  usdAmount: string;
  bondAmount: string;
}

/** The demo party keys the verticals switch between. */
export type TokenizationPartyKey = 'issuer' | 'alice' | 'bob';
export type DvpPartyKey = 'venue' | 'alice' | 'bob';

/** A uniform ok result for mutation endpoints. */
export interface OkResult {
  ok: true;
}
