/**
 * The backend interface the hooks read/submit through, plus a demo implementation
 * against the in-memory store. Model 2: PartyLayer owns none of this; the dApp
 * supplies these fetchers. In real mode each method becomes an ACS query or a
 * registry-mediated command submission (see the README "Real mode" section).
 */
import type {
  TokenHoldingRef,
  TokenTransfer,
  TokenAllocationRef,
  TokenTransferInstructionRef,
  TransferInstructionActionRequest,
  AllocationInstructionRequest,
  AllocationActionRequest,
} from '@partylayer/react/query';
import type { DemoPartyKey, InstrumentConfig } from './types';
import { demoStore, latency } from './store';
import { INSTRUMENT, PARTIES } from './fixtures';

/** Issuer-only admin operations, exercised through the generic `useChoice`. */
export type IssuerChoice =
  | { kind: 'mint'; toParty: DemoPartyKey; amount: string }
  | { kind: 'setFrozen'; party: DemoPartyKey; cid: string; frozen: boolean };

export interface TokenizationBackend {
  /** ACS read: a party's holdings as `{ cid, holding }` refs. `null` means none yet. */
  readHoldings(party: DemoPartyKey, signal?: AbortSignal): Promise<TokenHoldingRef[] | null>;
  /** ACS read: a party's pending incoming transfer instructions. `null` means none yet. */
  readIncoming(party: DemoPartyKey, signal?: AbortSignal): Promise<TokenTransferInstructionRef[] | null>;
  /**
   * ACS read: a party's holdings refs for the issuer freeze panel, read through the
   * generic `useDamlContract` (so that hook stays exercised alongside the typed ones).
   */
  readHoldingRefs(party: DemoPartyKey, signal?: AbortSignal): Promise<TokenHoldingRef[] | null>;
  /** Read: the instrument configuration (generic contract read). */
  readInstrument(signal?: AbortSignal): Promise<InstrumentConfig | null>;
  /** Read: the total supply across parties (issuer summary). */
  readSupply(signal?: AbortSignal): Promise<string | null>;
  /** ACS read: the static allocations list as `{ cid, allocation }` refs. */
  readAllocations(signal?: AbortSignal): Promise<TokenAllocationRef[] | null>;

  /** Submit: initiate a transfer (creates a pending instruction for the receiver). */
  submitTransfer(transfer: TokenTransfer, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: a completion choice (accept/reject/withdraw) on a transfer instruction. */
  submitTransferAction(
    request: TransferInstructionActionRequest,
    signal?: AbortSignal,
  ): Promise<{ ok: true }>;
  /** Submit: an issuer admin choice (mint/freeze), the registry-specific escape hatch. */
  submitIssuerChoice(choice: IssuerChoice, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: create an allocation via the factory (wired, fixture result). */
  submitAllocation(request: AllocationInstructionRequest, signal?: AbortSignal): Promise<{ ok: true }>;
  /** Submit: act on a funded allocation (executeTransfer/cancel/withdraw; fixture result). */
  submitAllocationAction(request: AllocationActionRequest, signal?: AbortSignal): Promise<{ ok: true }>;
}

/** Reject if the caller aborted while we were "in flight". */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

function partyIdToKey(partyId: string): DemoPartyKey {
  for (const key of Object.keys(PARTIES) as DemoPartyKey[]) {
    if (PARTIES[key].partyId === partyId) return key;
  }
  throw new Error('Unknown party id: ' + partyId);
}

export const demoBackend: TokenizationBackend = {
  async readHoldings(party, signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.holdingsOf(party);
  },

  async readIncoming(party, signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.incomingOf(party);
  },

  async readHoldingRefs(party, signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.holdingsOf(party);
  },

  async readInstrument(signal) {
    await latency();
    throwIfAborted(signal);
    return INSTRUMENT;
  },

  async readSupply(signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.totalSupply();
  },

  async readAllocations(signal) {
    await latency();
    throwIfAborted(signal);
    return demoStore.allocations();
  },

  async submitTransfer(transfer, signal) {
    await latency();
    throwIfAborted(signal);
    const memo = transfer.meta?.memo;
    demoStore.initiateTransfer(transfer.sender, transfer.receiver, transfer.amount, memo);
    return { ok: true };
  },

  async submitTransferAction(request, signal) {
    await latency();
    throwIfAborted(signal);
    // The demo tracks the instruction on the receiver's list; find who holds it.
    const receiverKey = findIncomingReceiver(request.instructionCid);
    if (!receiverKey) throw new Error('Instruction not found: ' + request.instructionCid);
    if (request.action === 'accept') {
      demoStore.resolveIncoming(PARTIES[receiverKey].partyId, request.instructionCid, true);
    } else {
      // reject and withdraw both release the instruction; the demo refunds the sender.
      demoStore.resolveIncoming(PARTIES[receiverKey].partyId, request.instructionCid, false);
    }
    return { ok: true };
  },

  // Mint and freeze are registry-specific admin operations. Real registries
  // typically expose issuance through the standard's BurnMintV1
  // (BurnMintFactory_BurnMint, which returns outputCids) or a custom admin choice;
  // the exact choice fields are registry-defined and not asserted here. This demo
  // shows the generic `useChoice` escape hatch for registry-specific writes
  // alongside the typed CIP-0056 hooks.
  async submitIssuerChoice(choice, signal) {
    await latency();
    throwIfAborted(signal);
    if (choice.kind === 'mint') {
      demoStore.mint(PARTIES[choice.toParty].partyId, choice.amount);
    } else {
      demoStore.setFrozen(choice.party, choice.cid, choice.frozen);
    }
    return { ok: true };
  },

  async submitAllocation(request, signal) {
    await latency();
    throwIfAborted(signal);
    // Registry-specific in real mode; the demo just validates the sender is known.
    partyIdToKey(request.allocation.transferLeg.sender);
    return { ok: true };
  },

  async submitAllocationAction(request, signal) {
    await latency();
    throwIfAborted(signal);
    // Registry-specific in real mode; the demo accepts any of the three actions.
    if (!['executeTransfer', 'cancel', 'withdraw'].includes(request.action)) {
      throw new Error('Unknown allocation action: ' + request.action);
    }
    return { ok: true };
  },
};

/** Which demo party currently holds a pending instruction, by cid. */
function findIncomingReceiver(instructionCid: string): DemoPartyKey | null {
  for (const key of Object.keys(PARTIES) as DemoPartyKey[]) {
    if (demoStore.incomingOf(key).some((it) => it.cid === instructionCid)) return key;
  }
  return null;
}
