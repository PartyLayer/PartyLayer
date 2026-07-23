/**
 * The gateway's backend abstraction: a one to one mapping of the two verticals'
 * existing backend interfaces (apps/tokenization/src/lib/backend.ts and
 * apps/dvp/src/lib/backend.ts). Both mock and live implement this; the server wires
 * HTTP routes to it. Every mutation returns `{ ok: true }`.
 */
import type {
  TokenHoldingRef,
  TokenTransferInstructionRef,
  TokenAllocationRef,
  TokenAllocationRequestRef,
  TokenTransfer,
  TransferInstructionActionRequest,
  AllocationInstructionRequest,
  AllocationActionRequest,
  AllocationRequestActionRequest,
  IssuerChoice,
  InstrumentConfig,
  SettleTrade,
  CreateTrade,
  OkResult,
} from './contract.js';
import type { GatewayConfig } from './config.js';

export interface TokenizationBackend {
  readHoldings(party: string): Promise<TokenHoldingRef[] | null>;
  readIncoming(party: string): Promise<TokenTransferInstructionRef[] | null>;
  readHoldingRefs(party: string): Promise<TokenHoldingRef[] | null>;
  readInstrument(): Promise<InstrumentConfig | null>;
  readSupply(): Promise<string | null>;
  readAllocations(): Promise<TokenAllocationRef[] | null>;
  submitTransfer(transfer: TokenTransfer): Promise<OkResult>;
  submitTransferAction(request: TransferInstructionActionRequest): Promise<OkResult>;
  submitIssuerChoice(choice: IssuerChoice): Promise<OkResult>;
  submitAllocation(request: AllocationInstructionRequest): Promise<OkResult>;
  submitAllocationAction(request: AllocationActionRequest): Promise<OkResult>;
}

export interface DvpBackend {
  readHoldings(party: string): Promise<TokenHoldingRef[] | null>;
  readTrades(): Promise<TokenAllocationRequestRef[] | null>;
  readAllocations(party: string): Promise<TokenAllocationRef[] | null>;
  readMatchedLegs(requestCid: string): Promise<string[]>;
  submitAllocation(request: AllocationInstructionRequest): Promise<OkResult>;
  submitAllocationAction(request: AllocationActionRequest): Promise<OkResult>;
  submitRequestAction(request: AllocationRequestActionRequest): Promise<OkResult>;
  submitSettle(vars: SettleTrade): Promise<OkResult>;
  submitCreateTrade(vars: CreateTrade): Promise<OkResult>;
}

export interface Backends {
  tokenization: TokenizationBackend;
  dvp: DvpBackend;
  /** Free any resources (live mode ledger client). */
  close(): Promise<void>;
}

/** Pick the backend implementation by mode. Live is loaded lazily so mock never imports the sdk. */
export async function createBackends(cfg: GatewayConfig): Promise<Backends> {
  if (cfg.mode === 'live') {
    const { createLiveBackends } = await import('./live/backend.js');
    return createLiveBackends(cfg);
  }
  const { createMockBackends } = await import('./mock/backend.js');
  return createMockBackends();
}
