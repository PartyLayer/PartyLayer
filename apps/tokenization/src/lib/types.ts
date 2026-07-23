/**
 * App-level view models for the Tokenization example.
 *
 * These COMPOSE the real exported CIP-0056 types from `@partylayer/react/query`.
 * They are not spec records; they are the shapes a dApp assembles for its own UI
 * from what an ACS query and the registry return.
 */
import type {
  TokenHolding,
  TokenTransfer,
  TransferInstructionStatus,
  TokenAllocation,
} from '@partylayer/react/query';

/** The three demo parties this example switches between. */
export type DemoPartyKey = 'issuer' | 'alice' | 'bob';

export interface DemoParty {
  key: DemoPartyKey;
  label: string;
  /** The party id string (Daml `Party`). */
  partyId: string;
}

/**
 * A holding as the dApp tracks it: the standard {@link TokenHolding} VIEW plus the
 * ACS contract id. FINDING: the CIP-0056 `HoldingView` (and so `TokenHolding`)
 * carries no contract id, but transfers need `inputHoldingCids` and per-holding
 * actions need to identify a holding, so a dApp must keep the cid alongside the
 * view. A real ACS query returns `{ contractId, view }` pairs; this mirrors that.
 */
export interface HoldingRef {
  cid: string;
  holding: TokenHolding;
}

/**
 * A pending incoming transfer instruction as the receiver's UI sees it. COMPOSED
 * from the exported types (`TokenTransfer` + `TransferInstructionStatus`) plus the
 * instruction's contract id. FINDING: the package exports no typed instruction
 * view, so the dApp assembles this app-level shape itself.
 */
export interface IncomingTransfer {
  instructionCid: string;
  transfer: TokenTransfer;
  status: TransferInstructionStatus;
}

/** A small instrument-config view read through the generic `useDamlContract`. */
export interface InstrumentConfig {
  admin: string;
  id: string;
  name: string;
  description: string;
}

/** An allocation as the read list shows it: the standard view plus its cid. */
export interface AllocationRef {
  cid: string;
  allocation: TokenAllocation;
}
