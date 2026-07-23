/**
 * A tiny in-memory mutable store initialized from the fixtures. It stands in for a
 * validator's active-contract set so every hook exercises real loading, success,
 * error, and invalidation without a live ledger. Small artificial latency makes
 * loading states visible.
 *
 * Decimal amounts stay strings throughout; arithmetic goes through the two-decimal
 * helpers in `./format` (documented simplification).
 */
import type {
  TokenHoldingRef,
  TokenTransferInstructionRef,
  TokenAllocationRef,
} from '@partylayer/react/query';
import type { DemoPartyKey } from './types';
import { PARTIES, seedHoldings, seedIncoming, seedAllocations, INSTRUMENT } from './fixtures';
import { addAmount, subAmount, cmpAmount } from './format';

interface StoreState {
  holdings: Record<DemoPartyKey, TokenHoldingRef[]>;
  incoming: Record<DemoPartyKey, TokenTransferInstructionRef[]>;
  allocations: TokenAllocationRef[];
}

let state: StoreState = freshState();
let cidCounter = 0;

function freshState(): StoreState {
  return {
    holdings: seedHoldings(),
    incoming: seedIncoming(),
    allocations: seedAllocations(),
  };
}

function nextCid(prefix: string): string {
  cidCounter += 1;
  // The 'gen' namespace keeps generated cids from colliding with the fixed seed
  // cids (e.g. 'h-alice-1'), so a change output is never filtered out with a
  // spent input that happens to share a numeric suffix.
  return prefix + '-gen' + cidCounter.toString();
}

/** Map a party id string back to its demo key (fixtures use fixed ids). */
function keyOf(partyId: string): DemoPartyKey | null {
  for (const key of Object.keys(PARTIES) as DemoPartyKey[]) {
    if (PARTIES[key].partyId === partyId) return key;
  }
  return null;
}

/** Artificial latency so loading skeletons are visible (200 to 400 ms). */
export function latency(): Promise<void> {
  const ms = 200 + ((cidCounter * 37) % 200);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const demoStore = {
  reset(): void {
    state = freshState();
    cidCounter = 0;
  },

  holdingsOf(party: DemoPartyKey): TokenHoldingRef[] {
    return state.holdings[party].map((ref) => ({ cid: ref.cid, holding: { ...ref.holding } }));
  },

  incomingOf(party: DemoPartyKey): TokenTransferInstructionRef[] {
    return state.incoming[party].map((it) => ({ ...it }));
  },

  allocations(): TokenAllocationRef[] {
    return state.allocations.map((a) => ({ cid: a.cid, allocation: a.allocation }));
  },

  /** Contract ids of a party's UNLOCKED holdings, for building `inputHoldingCids`. */
  unlockedCids(party: DemoPartyKey): string[] {
    return state.holdings[party].filter((ref) => !ref.holding.lock).map((ref) => ref.cid);
  },

  /** Total held per party, summed across holdings (string arithmetic). */
  balanceOf(party: DemoPartyKey): string {
    return state.holdings[party].reduce((sum, ref) => addAmount(sum, ref.holding.amount), '0.00');
  },

  /** Total supply across all parties for the instrument. */
  totalSupply(): string {
    return (Object.keys(state.holdings) as DemoPartyKey[]).reduce(
      (sum, party) => addAmount(sum, this.balanceOf(party)),
      '0.00',
    );
  },

  /** Consume `amount` from a party's unlocked holdings (archives inputs, writes change). */
  debit(party: DemoPartyKey, amount: string): void {
    const unlocked = state.holdings[party].filter((ref) => !ref.holding.lock);
    const available = unlocked.reduce((sum, ref) => addAmount(sum, ref.holding.amount), '0.00');
    if (cmpAmount(available, amount) < 0) {
      throw new Error(
        'Insufficient unlocked balance: need ' + amount + ' but only ' + available + ' is available.',
      );
    }
    let remaining = amount;
    const spentCids = new Set<string>();
    for (const ref of unlocked) {
      if (cmpAmount(remaining, '0.00') <= 0) break;
      spentCids.add(ref.cid);
      if (cmpAmount(ref.holding.amount, remaining) >= 0) {
        const change = subAmount(ref.holding.amount, remaining);
        remaining = '0.00';
        if (cmpAmount(change, '0.00') > 0) {
          state.holdings[party].push({
            cid: nextCid('h-' + party),
            holding: { ...ref.holding, amount: change, lock: undefined },
          });
        }
      } else {
        remaining = subAmount(remaining, ref.holding.amount);
      }
    }
    state.holdings[party] = state.holdings[party].filter((ref) => !spentCids.has(ref.cid));
  },

  /** Credit a party with a new unlocked holding. */
  credit(partyId: string, amount: string, meta?: Record<string, string>): void {
    const party = keyOf(partyId);
    if (!party) throw new Error('Unknown party to credit.');
    state.holdings[party].push({
      cid: nextCid('h-' + party),
      holding: {
        owner: partyId,
        instrumentId: { admin: INSTRUMENT.admin, id: INSTRUMENT.id },
        amount,
        lock: undefined,
        meta: meta ?? {},
      },
    });
  },

  /**
   * Initiate a transfer (two-step model): debit the sender now and create a pending
   * incoming instruction for the receiver to accept. Throws on insufficient unlocked
   * balance (drives the error path). Returns the new instruction cid.
   */
  initiateTransfer(senderId: string, receiverId: string, amount: string, memo?: string): string {
    const sender = keyOf(senderId);
    const receiver = keyOf(receiverId);
    if (!sender || !receiver) throw new Error('Unknown party in transfer.');

    const inputCids = this.unlockedCids(sender);
    this.debit(sender, amount);

    const instructionCid = nextCid('ti-' + sender + '-' + receiver);
    state.incoming[receiver].push({
      cid: instructionCid,
      instruction: {
        transfer: {
          sender: senderId,
          receiver: receiverId,
          amount,
          instrumentId: { admin: INSTRUMENT.admin, id: INSTRUMENT.id },
          requestedAt: '2026-07-22T09:00:00Z',
          executeBefore: '2027-01-01T00:00:00Z',
          inputHoldingCids: inputCids,
          meta: memo ? { memo } : {},
        },
        status: { kind: 'pendingReceiverAcceptance' },
      },
    });
    return instructionCid;
  },

  /**
   * Resolve a pending incoming instruction. Accept credits the receiver; reject
   * refunds the amount back to the sender (the debit is reversed).
   */
  resolveIncoming(receiverId: string, instructionCid: string, accept: boolean): void {
    const receiver = keyOf(receiverId);
    if (!receiver) throw new Error('Unknown receiver party.');
    const item = state.incoming[receiver].find((it) => it.cid === instructionCid);
    if (!item) throw new Error('Instruction not found: ' + instructionCid);

    state.incoming[receiver] = state.incoming[receiver].filter((it) => it.cid !== instructionCid);
    const transfer = item.instruction.transfer;
    if (accept) {
      this.credit(receiverId, transfer.amount, transfer.meta);
    } else {
      this.credit(transfer.sender, transfer.amount, { refunded: 'true' });
    }
  },

  /** Issuer mint: create a new holding for a party. */
  mint(toPartyId: string, amount: string): void {
    const to = keyOf(toPartyId);
    if (!to) throw new Error('Unknown mint target party.');
    state.holdings[to].push({
      cid: nextCid('h-' + to),
      holding: {
        owner: toPartyId,
        instrumentId: { admin: INSTRUMENT.admin, id: INSTRUMENT.id },
        amount,
        lock: undefined,
        meta: { minted: 'true' },
      },
    });
  },

  /** Issuer freeze toggle: add or remove the lock on a holding by cid. */
  setFrozen(party: DemoPartyKey, cid: string, frozen: boolean): void {
    const ref = state.holdings[party].find((h) => h.cid === cid);
    if (!ref) throw new Error('Holding not found: ' + cid);
    ref.holding = {
      ...ref.holding,
      lock: frozen
        ? { holders: [INSTRUMENT.admin], expiresAt: '2027-01-01T00:00:00Z', context: 'frozen by issuer' }
        : undefined,
    };
  },
};
