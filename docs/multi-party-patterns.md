# Multi-party transaction patterns

Multi-party flows on Canton are expressed as on-ledger workflows between parties. A
transfer is a contract the receiver acts on; a settlement is a contract whose choice
moves several parties' assets at once. The atomicity of these flows lives in Daml, in
the choice bodies, not in the client. The client's job is to read the right contract,
present the available action, and submit a well-formed exercise.

PartyLayer types each step of these workflows so a dApp does not hand-roll the request
shapes. This guide documents four patterns. For each: the problem, the on-ledger shape,
the kit surface, and a pointer to the working vertical that implements it.

A note on Model 2, which runs through all four: PartyLayer types the request and the
dApp owns the submit. The ledger read and the exercise both go through the dApp's own
transport, as described in the [topology guide](./partylayer-and-canton-topology.md).
The kit does not submit for you.

---

## 1. Two-step transfer (offer and accept)

**Problem.** A sender wants to move a holding to a receiver, but the receiver should be
able to accept or refuse, and the sender should be able to back out while it is pending.

**On-ledger shape.** Exercising `TransferFactory_Transfer` on the registry's transfer
factory creates a `TransferInstruction` contract. From there the receiver exercises
accept or reject, and the sender can withdraw. The instruction carries a status that
says which of these is currently possible.

**Kit surface.** `useTransferInstruction` initiates the transfer;
`useTransferInstructionAction` drives the completion actions, whose kinds are
`accept`, `reject`, and `withdraw` (`TransferInstructionActionKind`). Discriminate what
is allowed on the pending instruction via `TokenTransferInstructionStatus`:

```ts
// TokenTransferInstructionStatus, from @partylayer/react/query
type TokenTransferInstructionStatus =
  | { kind: 'pendingReceiverAcceptance' }
  | { kind: 'pendingInternalWorkflow'; pendingActions: Record<string, string> };
```

`pendingReceiverAcceptance` is the state where the receiver can accept or reject.
`pendingInternalWorkflow` carries `pendingActions`, a map from party to a short
description of which party could act to advance the transfer, which the wallet can show
to the user.

The transfer factory also reports a `transferKind` of `offer`, `direct`, or `self`:
`offer` waits for the receiver to accept, `direct` transfers straight through and is
only chosen when the receiver has pre-approved direct transfers, and `self` is a
self-transfer where sender and receiver are the same party and no approval is needed.

**Example.** The tokenization vertical (`apps/tokenization`).

---

## 2. Atomic delivery versus payment

**Problem.** Two parties want to swap assets so that either both legs move or neither
does. Neither side should be able to take delivery without paying.

**On-ledger shape.** A settlement app publishes a request for allocations. Each transfer
leg's sender allocates the asset it owes, producing an `Allocation` per leg. A single
settle choice on the settlement contract then runs `Allocation_ExecuteTransfer` for
every leg inside one transaction, so the whole settlement is all-or-nothing. The
official Splice token-standard trading-app example is the canonical reference for the
settle choice.

**Kit surface.** `useAllocationRequests` reads the pending requests a party can act on;
`useAllocationInstruction` allocates a leg; `useTokenAllocations` reads the funded
allocations; `useAllocationAction` acts on one. The venue's expected-allocation check,
deciding whether a given allocation actually satisfies a given leg of a request, uses
the framework-free matching helpers, chiefly `allocationMatchesRequestLeg`, so amount
comparison is decimal-as-string correct rather than a naive `===`.

Two deadlines on the request bound the flow: `allocateBefore`, by which the senders must
have allocated, and `settleBefore`, by which the executor must settle. And the settle
step is not a rehearsal: executing the transfer moves real assets on the ledger, so the
matching check and the deadlines matter before you submit it.

**Example.** The dvp vertical (`apps/dvp`), whose `src/lib/match.ts` is a thin adapter
over `allocationMatchesRequestLeg`.

---

## 3. Abort and release paths

**Problem.** Settlements do not always complete. A leg sender may decline, an executor
may find it cannot settle in time, or a party that allocated may need to reclaim its
asset. Each of these needs a defined owner, or funds get stuck.

**On-ledger shape.** There are release points at two levels. At the request level,
`AllocationRequest_Reject` and `AllocationRequest_Withdraw` end the request. At the
allocation level, an `Allocation` can be cancelled or withdrawn, releasing the asset the
sender had committed.

**Kit surface.** `useAllocationRequestAction` covers the request level with kinds
`reject` and `withdraw` (`AllocationRequestActionKind`). The two have different
controllers, which is the point: reject carries the acting party (the `actor`), and
implementations SHOULD allow any sender of a transfer leg to reject, while withdraw
belongs to the settlement's `executor`, used when the executor cannot execute.
`useAllocationAction` covers the allocation level with kinds `executeTransfer`,
`cancel`, and `withdraw` (`AllocationActionKind`); cancel and withdraw are the release
paths that hand the committed asset back. A venue UI needs these because a settlement
that cannot proceed must be closable by whoever is entitled to close it, rather than
left pending against the deadlines above.

**Example.** The dvp vertical (`apps/dvp`).

---

## 4. Registry-mediated writes

**Problem.** The registry-specific part of a write (which factory contract to use, what
reference data to disclose, what context a choice needs) is off-ledger and not
standardized in the ledger transaction itself. The client cannot invent it.

**On-ledger shape.** Every write goes through a registry factory or a per-action choice
context. The dApp fetches that context from the registry's off-ledger API and passes it
into the exercise as `extraArgs.context`, alongside the `disclosedContracts` the choice
references. This is why the kit types the request but the dApp owns the submit: the
registry context is fetched by the dApp's own fetcher, so PartyLayer cannot and does not
supply it. That is Model 2.

**Kit surface.** The disclosure helpers are the shared plumbing here.
`TokenDisclosedContract` and `TokenChoiceContext` are the typed shapes the registry
returns. When a submission combines more than one context, `mergeDisclosedContracts`
folds their disclosures into one set, and `assertSingleSynchronizer` checks that set is
consistent on a single synchronizer before you build the command. A sketch of where they
sit in a submit fetcher:

```ts
import {
  mergeDisclosedContracts,
  assertSingleSynchronizer,
} from '@partylayer/react/query';

// ctxA, ctxB: TokenChoiceContext values fetched from the registry
const disclosed = mergeDisclosedContracts(ctxA.disclosedContracts, ctxB.disclosedContracts);
assertSingleSynchronizer(disclosed); // throws if the contexts span synchronizers
// ...exercise the choice with extraArgs.context filled and `disclosed` attached.
```

**Example.** Both verticals write this way; the disclosed-contract and choice-context
shapes are shared across tokenization and dvp. See the
[CIP-0056 specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md)
for the standard these shapes mirror.

---

## See also

- [Privacy-aware reads on Canton](./privacy-and-reads.md)
- [Generic Bridge (wallet discovery)](./generic-bridge.md)
- [PartyLayer and Canton Topology](./partylayer-and-canton-topology.md)
- [CIP-0056 (Canton Token Standard) specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md)
