/**
 * Self-contained in-memory fixture store for GATEWAY_MODE=mock. It reproduces the
 * two verticals' seed data and flows so the full endpoint contract is verifiable
 * today without DevNet. Portable on purpose: the gateway does not import app source.
 * Amounts are decimal strings; arithmetic uses two-decimal bigint cents.
 */
import type {
  TokenHoldingRef,
  TokenHolding,
  TokenTransferInstructionRef,
  TokenAllocationRef,
  TokenAllocationRequestRef,
  TokenTransferLeg,
  TokenTransfer,
  TransferInstructionActionRequest,
  AllocationInstructionRequest,
  AllocationActionRequest,
  AllocationRequestActionRequest,
  IssuerChoice,
  InstrumentConfig,
  SettleTrade,
  CreateTrade,
} from '../contract.js';

const SCALE = 100n;
const cents = (a: string): bigint => {
  const [w, f = ''] = a.trim().split('.');
  return BigInt(w || '0') * SCALE + BigInt(((f + '00').slice(0, 2)) || '0');
};
const amt = (c: bigint): string => (c / SCALE).toString() + '.' + (c % SCALE).toString().padStart(2, '0');
const add = (a: string, b: string) => amt(cents(a) + cents(b));
const sub = (a: string, b: string) => amt(cents(a) - cents(b));
const cmp = (a: string, b: string) => (cents(a) > cents(b) ? 1 : cents(a) < cents(b) ? -1 : 0);

let counter = 0;
const nextCid = (p: string) => p + '-gen' + (++counter).toString();
const nowIso = () => new Date().toISOString();

// ---- Party ids (mock; matched to the verticals' fixture ids so the apps' write
// payloads, which embed these ids as sender/receiver, resolve here. Live mode uses
// real DevNet party ids from env instead). ----
const T = { issuer: 'issuer::12208a3f9b', alice: 'alice::1220b7c142', bob: 'bob::1220e4d9a0' };
const D = { venue: 'venue::12208a3f9b', alice: 'alice::1220b7c142', bob: 'bob::1220e4d9a0' };
const REGISTRY = 'registry::1220c0ffee';
const DEMO = { admin: T.issuer, id: 'DEMO' };
const USD = { admin: REGISTRY, id: 'DEMO-USD' };
const BOND = { admin: REGISTRY, id: 'DEMO-BOND' };
const FUTURE_A = '2027-01-01T00:00:00Z';
const FUTURE_S = '2027-01-02T00:00:00Z';

function holding(owner: string, inst: { admin: string; id: string }, amount: string, lock?: TokenHolding['lock']): TokenHolding {
  return { owner, instrumentId: { ...inst }, amount, lock, meta: {} };
}

// ==================== Tokenization vertical ====================
interface TokState {
  holdings: Record<string, TokenHoldingRef[]>;
  incoming: Record<string, TokenTransferInstructionRef[]>;
  allocations: TokenAllocationRef[];
}
function tokSeed(): TokState {
  return {
    holdings: {
      [T.issuer]: [{ cid: 'h-issuer-treasury', holding: holding(T.issuer, DEMO, '1000000.00') }],
      [T.alice]: [
        { cid: 'h-alice-1', holding: holding(T.alice, DEMO, '150.00') },
        { cid: 'h-alice-2', holding: holding(T.alice, DEMO, '50.00', { holders: [T.issuer], expiresAt: FUTURE_A, context: 'frozen by issuer' }) },
      ],
      [T.bob]: [{ cid: 'h-bob-1', holding: holding(T.bob, DEMO, '75.00') }],
    },
    incoming: {
      [T.issuer]: [],
      [T.alice]: [
        {
          cid: 'ti-bob-alice-1',
          instruction: {
            transfer: { sender: T.bob, receiver: T.alice, amount: '25.00', instrumentId: { ...DEMO }, requestedAt: '2026-07-22T09:00:00Z', executeBefore: FUTURE_A, inputHoldingCids: ['h-bob-1'], meta: { memo: 'lunch split' } },
            status: { kind: 'pendingReceiverAcceptance' },
          },
        },
      ],
      [T.bob]: [],
    },
    allocations: [
      {
        cid: 'alloc-tok-1',
        allocation: {
          allocation: {
            settlement: { executor: T.issuer, settlementRef: { id: 'settlement-demo-1', cid: 'settle-cid-1' }, requestedAt: '2026-07-22T09:00:00Z', allocateBefore: FUTURE_A, settleBefore: FUTURE_S },
            transferLegId: 'leg-1',
            transferLeg: { sender: T.alice, receiver: T.bob, amount: '10.00', instrumentId: { ...DEMO } },
          },
          holdingCids: ['h-alice-1'],
        },
      },
    ],
  };
}
const TOK_KEY: Record<string, string> = { issuer: T.issuer, alice: T.alice, bob: T.bob };
const TOK_INSTRUMENT: InstrumentConfig = { admin: T.issuer, id: 'DEMO', name: 'Demo Token', description: 'A demo instrument administered by the issuer party for this example.' };

// ==================== DvP vertical ====================
const LEG_USD = 'leg-usd';
const LEG_BOND = 'leg-bond';
interface DvpState {
  holdings: Record<string, TokenHoldingRef[]>;
  requests: TokenAllocationRequestRef[];
  allocations: Record<string, TokenAllocationRef[]>;
}
function trade(id: string, cid: string, usd: string, bond: string): TokenAllocationRequestRef {
  const legUsd: TokenTransferLeg = { sender: D.alice, receiver: D.bob, amount: usd, instrumentId: { ...USD } };
  const legBond: TokenTransferLeg = { sender: D.bob, receiver: D.alice, amount: bond, instrumentId: { ...BOND } };
  return {
    cid,
    request: {
      settlement: { executor: D.venue, settlementRef: { id, cid }, requestedAt: '2026-07-22T09:00:00Z', allocateBefore: FUTURE_A, settleBefore: FUTURE_S, meta: { venue: 'demo' } },
      transferLegs: { [LEG_USD]: legUsd, [LEG_BOND]: legBond },
      meta: { trade: id },
    },
  };
}
function dvpSeed(): DvpState {
  return {
    holdings: {
      [D.venue]: [],
      [D.alice]: [
        { cid: 'h-alice-usd-1', holding: holding(D.alice, USD, '300.00') },
        { cid: 'h-alice-usd-2', holding: holding(D.alice, USD, '50.00') },
      ],
      [D.bob]: [{ cid: 'h-bob-bond-1', holding: holding(D.bob, BOND, '10.00') }],
    },
    requests: [trade('trade-1', 'ar-cid-1', '100.00', '5.00')],
    allocations: { [D.venue]: [], [D.alice]: [], [D.bob]: [] },
  };
}
const DVP_KEY: Record<string, string> = { venue: D.venue, alice: D.alice, bob: D.bob };

// ==================== Store ====================
let tok = tokSeed();
let dvp = dvpSeed();

function legMatches(a: TokenTransferLeg, b: TokenTransferLeg): boolean {
  return a.sender === b.sender && a.receiver === b.receiver && cmp(a.amount, b.amount) === 0 && a.instrumentId.admin === b.instrumentId.admin && a.instrumentId.id === b.instrumentId.id;
}
function findDvpAlloc(requestCid: string, legId: string): { party: string; ref: TokenAllocationRef } | undefined {
  for (const party of Object.keys(dvp.allocations)) {
    for (const ref of dvp.allocations[party]) {
      const spec = ref.allocation.allocation;
      if (spec.settlement.settlementRef.cid === requestCid && spec.transferLegId === legId) return { party, ref };
    }
  }
  return undefined;
}
function dvpDebit(party: string, admin: string, id: string, amount: string, inputCids: string[]): void {
  const chosen = dvp.holdings[party].filter((r) => inputCids.includes(r.cid) && !r.holding.lock && r.holding.instrumentId.admin === admin && r.holding.instrumentId.id === id);
  const avail = chosen.reduce((s, r) => add(s, r.holding.amount), '0.00');
  if (cmp(avail, amount) < 0) throw new Error('Insufficient selected holdings: need ' + amount + ' but only ' + avail + ' is selected.');
  let remaining = amount;
  const spent = new Set<string>();
  for (const r of chosen) {
    if (cmp(remaining, '0.00') <= 0) break;
    spent.add(r.cid);
    if (cmp(r.holding.amount, remaining) >= 0) {
      const change = sub(r.holding.amount, remaining);
      remaining = '0.00';
      if (cmp(change, '0.00') > 0) dvp.holdings[party].push({ cid: nextCid('h-' + party), holding: { ...r.holding, amount: change, lock: undefined } });
    } else remaining = sub(remaining, r.holding.amount);
  }
  dvp.holdings[party] = dvp.holdings[party].filter((r) => !spent.has(r.cid));
}
function dvpCredit(partyId: string, admin: string, id: string, amount: string): void {
  dvp.holdings[partyId].push({ cid: nextCid('h-' + partyId), holding: { owner: partyId, instrumentId: { admin, id }, amount, lock: undefined, meta: {} } });
}
function releaseDvpAlloc(ref: TokenAllocationRef): void {
  const leg = ref.allocation.allocation.transferLeg;
  dvpCredit(leg.sender, leg.instrumentId.admin, leg.instrumentId.id, leg.amount);
  for (const p of Object.keys(dvp.allocations)) dvp.allocations[p] = dvp.allocations[p].filter((a) => a.cid !== ref.cid);
}

export const mockStore = {
  reset(): void {
    tok = tokSeed();
    dvp = dvpSeed();
    counter = 0;
  },

  // ---- tokenization reads ----
  tokHoldings: (party: string): TokenHoldingRef[] => (tok.holdings[TOK_KEY[party]] ?? []).map((r) => ({ cid: r.cid, holding: { ...r.holding } })),
  tokIncoming: (party: string): TokenTransferInstructionRef[] => (tok.incoming[TOK_KEY[party]] ?? []).map((i) => ({ ...i })),
  tokInstrument: (): InstrumentConfig => TOK_INSTRUMENT,
  tokSupply: (): string => Object.values(tok.holdings).flat().reduce((s, r) => add(s, r.holding.amount), '0.00'),
  tokAllocations: (): TokenAllocationRef[] => tok.allocations.map((a) => ({ cid: a.cid, allocation: a.allocation })),

  // ---- tokenization writes ----
  tokTransfer(transfer: TokenTransfer): void {
    const sender = transfer.sender;
    const senderKey = Object.keys(TOK_KEY).find((k) => TOK_KEY[k] === sender);
    if (!senderKey) throw new Error('Unknown sender party.');
    // debit sender unlocked, create pending incoming for receiver
    const unlocked = tok.holdings[sender].filter((r) => !r.holding.lock);
    const avail = unlocked.reduce((s, r) => add(s, r.holding.amount), '0.00');
    if (cmp(avail, transfer.amount) < 0) throw new Error('Insufficient unlocked balance: need ' + transfer.amount + ' but only ' + avail + ' is available.');
    let remaining = transfer.amount;
    const spent = new Set<string>();
    for (const r of unlocked) {
      if (cmp(remaining, '0.00') <= 0) break;
      spent.add(r.cid);
      if (cmp(r.holding.amount, remaining) >= 0) {
        const change = sub(r.holding.amount, remaining);
        remaining = '0.00';
        if (cmp(change, '0.00') > 0) tok.holdings[sender].push({ cid: nextCid('h-' + senderKey), holding: { ...r.holding, amount: change, lock: undefined } });
      } else remaining = sub(remaining, r.holding.amount);
    }
    tok.holdings[sender] = tok.holdings[sender].filter((r) => !spent.has(r.cid));
    const cid = nextCid('ti');
    tok.incoming[transfer.receiver] = tok.incoming[transfer.receiver] ?? [];
    tok.incoming[transfer.receiver].push({ cid, instruction: { transfer, status: { kind: 'pendingReceiverAcceptance' } } });
  },
  tokTransferAction(req: TransferInstructionActionRequest): void {
    for (const party of Object.keys(tok.incoming)) {
      const item = tok.incoming[party].find((i) => i.cid === req.instructionCid);
      if (item) {
        tok.incoming[party] = tok.incoming[party].filter((i) => i.cid !== req.instructionCid);
        const t = item.instruction.transfer;
        // accept credits the receiver; reject and withdraw refund the sender
        const credited = req.action === 'accept' ? t.receiver : t.sender;
        tok.holdings[credited].push({ cid: nextCid('h'), holding: holding(credited, t.instrumentId, t.amount) });
        return;
      }
    }
    throw new Error('Instruction not found: ' + req.instructionCid);
  },
  tokIssuerChoice(choice: IssuerChoice): void {
    if (choice.kind === 'mint') tok.holdings[TOK_KEY[choice.toParty]].push({ cid: nextCid('h'), holding: holding(TOK_KEY[choice.toParty], DEMO, choice.amount) });
    else {
      const list = tok.holdings[TOK_KEY[choice.party]];
      const ref = list.find((r) => r.cid === choice.cid);
      if (!ref) throw new Error('Holding not found: ' + choice.cid);
      ref.holding = { ...ref.holding, lock: choice.frozen ? { holders: [REGISTRY], expiresAt: FUTURE_A, context: 'frozen by issuer' } : undefined };
    }
  },
  tokAllocation(_req: AllocationInstructionRequest): void {
    // Demonstration: the tokenization allocations card is a fixture list; accept the request.
  },
  tokAllocationAction(_req: AllocationActionRequest): void {
    // Demonstration: accept the action (the tokenization allocations are illustrative).
  },

  // ---- dvp reads ----
  dvpHoldings: (party: string): TokenHoldingRef[] => (dvp.holdings[DVP_KEY[party]] ?? []).map((r) => ({ cid: r.cid, holding: { ...r.holding } })),
  dvpTrades: (): TokenAllocationRequestRef[] => dvp.requests.map((r) => ({ cid: r.cid, request: r.request })),
  dvpAllocations: (party: string): TokenAllocationRef[] => (dvp.allocations[DVP_KEY[party]] ?? []).map((a) => ({ cid: a.cid, allocation: a.allocation })),
  dvpMatchedLegs(requestCid: string): string[] {
    const req = dvp.requests.find((r) => r.cid === requestCid);
    if (!req) return [];
    return Object.keys(req.request.transferLegs).filter((legId) => {
      const found = findDvpAlloc(requestCid, legId);
      return !!found && legMatches(found.ref.allocation.allocation.transferLeg, req.request.transferLegs[legId]);
    });
  },

  // ---- dvp writes ----
  dvpAllocation(req: AllocationInstructionRequest): void {
    const requestCid = req.allocation.settlement.settlementRef.cid;
    if (!requestCid) throw new Error('Allocation is missing its settlement request cid.');
    const legId = req.allocation.transferLegId;
    const leg = req.allocation.transferLeg;
    const senderKey = Object.keys(DVP_KEY).find((k) => DVP_KEY[k] === leg.sender);
    if (!senderKey) throw new Error('Unknown leg sender.');
    const trade = dvp.requests.find((r) => r.cid === requestCid);
    if (trade && nowIso() >= trade.request.settlement.allocateBefore) throw new Error('Allocation window has closed.');
    if (findDvpAlloc(requestCid, legId)) throw new Error('This leg is already allocated.');
    dvpDebit(leg.sender, leg.instrumentId.admin, leg.instrumentId.id, leg.amount, req.inputHoldingCids);
    dvp.allocations[leg.sender].push({ cid: nextCid('alloc-' + senderKey), allocation: { allocation: { settlement: req.allocation.settlement, transferLegId: legId, transferLeg: leg }, holdingCids: [nextCid('backing')], meta: {} } });
  },
  dvpAllocationAction(req: AllocationActionRequest): void {
    for (const party of Object.keys(dvp.allocations)) {
      const ref = dvp.allocations[party].find((a) => a.cid === req.allocationCid);
      if (ref) {
        if (req.action === 'executeTransfer') throw new Error('executeTransfer is settled atomically by the venue in this example.');
        releaseDvpAlloc(ref);
        return;
      }
    }
    throw new Error('Allocation not found: ' + req.allocationCid);
  },
  dvpRequestAction(req: AllocationRequestActionRequest): void {
    const trade = dvp.requests.find((r) => r.cid === req.requestCid);
    if (!trade) throw new Error('Trade not found: ' + req.requestCid);
    if (req.action === 'reject') {
      const senders = Object.values(trade.request.transferLegs).map((l) => l.sender);
      if (!senders.includes(req.actor)) throw new Error('Only a transfer-leg sender can reject.');
    }
    // release allocations backing this request, drop the request
    for (const p of Object.keys(dvp.allocations)) {
      for (const ref of [...dvp.allocations[p]]) if (ref.allocation.allocation.settlement.settlementRef.cid === req.requestCid) releaseDvpAlloc(ref);
    }
    dvp.requests = dvp.requests.filter((r) => r.cid !== req.requestCid);
  },
  dvpSettle(vars: SettleTrade): void {
    const trade = dvp.requests.find((r) => r.cid === vars.requestCid);
    if (!trade) throw new Error('Trade not found: ' + vars.requestCid);
    if (nowIso() >= trade.request.settlement.settleBefore) throw new Error('Settlement window has closed.');
    const legIds = Object.keys(trade.request.transferLegs);
    const matched: { ref: TokenAllocationRef; leg: TokenTransferLeg }[] = [];
    const missing: string[] = [];
    for (const legId of legIds) {
      const leg = trade.request.transferLegs[legId];
      const found = findDvpAlloc(vars.requestCid, legId);
      if (found && legMatches(found.ref.allocation.allocation.transferLeg, leg)) matched.push({ ref: found.ref, leg });
      else missing.push(legId);
    }
    if (missing.length > 0) throw new Error('Cannot settle: unallocated legs [' + missing.join(', ') + ']. Nothing moved.');
    for (const { ref, leg } of matched) {
      dvpCredit(leg.receiver, leg.instrumentId.admin, leg.instrumentId.id, leg.amount);
      for (const p of Object.keys(dvp.allocations)) dvp.allocations[p] = dvp.allocations[p].filter((a) => a.cid !== ref.cid);
    }
    dvp.requests = dvp.requests.filter((r) => r.cid !== vars.requestCid);
  },
  dvpCreateTrade(vars: CreateTrade): void {
    const n = dvp.requests.length + counter + 1;
    dvp.requests.push(trade('trade-' + n.toString(), nextCid('ar'), vars.usdAmount, vars.bondAmount));
  },
};
