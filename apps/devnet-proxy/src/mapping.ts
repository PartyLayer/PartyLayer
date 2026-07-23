/**
 * Pure mapping from ledger/registry ACS payloads into the CIP-0056 ref shapes the
 * verticals consume. A validator JSON API active-contract entry is a contract id
 * plus the token-standard interface view; these functions turn each into a
 * `{ cid, view }` ref. No SDK, no IO, no framework: unit testable on fixtures.
 *
 * Daml JSON quirks handled: Optional encodes as the value or null; TextMap encodes
 * as a plain object; a variant encodes as `{ tag, value }`. Amounts stay strings.
 */
import type {
  TokenHoldingRef,
  TokenHolding,
  TokenLock,
  TokenTransferInstructionRef,
  TokenTransferInstructionStatus,
  TokenAllocationRef,
  TokenAllocationRequestRef,
  TokenTransferLeg,
  TokenSettlementInfo,
  TokenInstrumentId,
} from './contract.js';

/** One active contract as the ledger JSON API returns it: an id plus its interface view. */
export interface AcsEntry {
  contractId: string;
  view: Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}
function opt(v: unknown): string | undefined {
  return v === null || v === undefined ? undefined : str(v);
}
function meta(v: unknown): Record<string, string> | undefined {
  if (v === null || v === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = str(val);
  return out;
}
function instrumentId(v: unknown): TokenInstrumentId {
  const o = (v ?? {}) as Record<string, unknown>;
  return { admin: str(o.admin), id: str(o.id) };
}
function transferLeg(v: unknown): TokenTransferLeg {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    sender: str(o.sender),
    receiver: str(o.receiver),
    amount: str(o.amount),
    instrumentId: instrumentId(o.instrumentId),
    meta: meta(o.meta),
  };
}
function settlement(v: unknown): TokenSettlementInfo {
  const o = (v ?? {}) as Record<string, unknown>;
  const ref = (o.settlementRef ?? {}) as Record<string, unknown>;
  return {
    executor: str(o.executor),
    settlementRef: { id: str(ref.id), cid: opt(ref.cid) },
    requestedAt: str(o.requestedAt),
    allocateBefore: str(o.allocateBefore),
    settleBefore: str(o.settleBefore),
    meta: meta(o.meta),
  };
}

/** Map a HoldingV1 interface view into a holding ref. */
export function mapHolding(entry: AcsEntry): TokenHoldingRef {
  const v = entry.view;
  const lockRaw = v.lock as Record<string, unknown> | null | undefined;
  const lock: TokenLock | undefined =
    lockRaw == null
      ? undefined
      : {
          holders: Array.isArray(lockRaw.holders) ? (lockRaw.holders as unknown[]).map(str) : [],
          expiresAt: opt(lockRaw.expiresAt),
          expiresAfter: opt(lockRaw.expiresAfter),
          context: opt(lockRaw.context),
        };
  const holding: TokenHolding = {
    owner: str(v.owner),
    instrumentId: instrumentId(v.instrumentId),
    amount: str(v.amount),
    lock,
    meta: meta(v.meta),
  };
  return { cid: entry.contractId, holding };
}

/** Map the Daml TransferInstructionStatus variant into the typed status union. */
export function mapInstructionStatus(v: unknown): TokenTransferInstructionStatus {
  const o = (v ?? {}) as Record<string, unknown>;
  const tag = str(o.tag);
  if (tag === 'TransferPendingInternalWorkflow') {
    const value = (o.value ?? {}) as Record<string, unknown>;
    return {
      kind: 'pendingInternalWorkflow',
      pendingActions: meta(value.pendingActions) ?? {},
    };
  }
  // TransferPendingReceiverAcceptance (and any other) map to the acceptance state.
  return { kind: 'pendingReceiverAcceptance' };
}

/** Map a TransferInstructionV1 interface view into an instruction ref. */
export function mapTransferInstruction(entry: AcsEntry): TokenTransferInstructionRef {
  const v = entry.view;
  return {
    cid: entry.contractId,
    instruction: {
      originalInstructionCid: opt(v.originalInstructionCid),
      transfer: mapTransfer(v.transfer),
      status: mapInstructionStatus(v.status),
      meta: meta(v.meta),
    },
  };
}

/** Map a Transfer record (the transfer instruction's transfer field). */
function mapTransfer(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    sender: str(o.sender),
    receiver: str(o.receiver),
    amount: str(o.amount),
    instrumentId: instrumentId(o.instrumentId),
    requestedAt: str(o.requestedAt),
    executeBefore: str(o.executeBefore),
    inputHoldingCids: Array.isArray(o.inputHoldingCids) ? (o.inputHoldingCids as unknown[]).map(str) : [],
    meta: meta(o.meta),
  };
}

/** Map an AllocationV1 interface view into an allocation ref. */
export function mapAllocation(entry: AcsEntry): TokenAllocationRef {
  const v = entry.view;
  const alloc = (v.allocation ?? {}) as Record<string, unknown>;
  return {
    cid: entry.contractId,
    allocation: {
      allocation: {
        settlement: settlement(alloc.settlement),
        transferLegId: str(alloc.transferLegId),
        transferLeg: transferLeg(alloc.transferLeg),
      },
      holdingCids: Array.isArray(v.holdingCids) ? (v.holdingCids as unknown[]).map(str) : [],
      meta: meta(v.meta),
    },
  };
}

/** Map an AllocationRequestV1 interface view into a request ref. */
export function mapAllocationRequest(entry: AcsEntry): TokenAllocationRequestRef {
  const v = entry.view;
  const legsRaw = (v.transferLegs ?? {}) as Record<string, unknown>;
  const transferLegs: Record<string, TokenTransferLeg> = {};
  for (const [legId, leg] of Object.entries(legsRaw)) transferLegs[legId] = transferLeg(leg);
  return {
    cid: entry.contractId,
    request: {
      settlement: settlement(v.settlement),
      transferLegs,
      meta: meta(v.meta),
    },
  };
}
