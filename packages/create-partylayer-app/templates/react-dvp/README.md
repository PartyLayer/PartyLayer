# {{PROJECT_NAME}}

A DvP (delivery versus payment) vertical for Canton, scaffolded with
create-partylayer-app. A single-page dApp where a settlement venue runs an atomic
two-leg trade over the CIP-0056 (Canton Token Standard) allocation surface. A trade
IS an allocation request; each counterparty allocates its leg; the venue settles both
legs in one all-or-nothing step.

Everything runs on an in-memory demo backend (typed fixtures behind a small
`DvpBackend` interface), so every hook is exercised for real (loading, success,
error, invalidation) without a live ledger. Model 2 throughout: PartyLayer owns none
of the transport; the dApp supplies every read and submit fetcher, and the hooks type
the request and wrap the query or mutation.

> Reference quality, NOT production audited. This template demonstrates the API in a
> realistic composition. Review, test, and harden it before using it in production.

## Run it

```bash
npm create partylayer-app@latest my-app -- --template react-dvp
cd my-app
npm install
npm run dev
```

## What is on screen

A header with the connect UI, a demo-party switcher (venue / alice / bob), a
synchronizer picker, and a light/dark toggle (the gold theme family); then three
section cards:

| Section | Hook(s) exercised |
| :-- | :-- |
| Trades | `useAllocationRequests`, `useAllocationInstruction`, `useAllocationRequestAction` (counterparty); `useTokenAllocations`, `useChoice`, `useAllocationAction` (venue) |
| My allocations | `useTokenAllocations` and `useAllocationAction` (withdraw) |
| Holdings | `useTokenHoldings` |

A trade is an allocation request: `settlement { executor: the venue, settlementRef,
requestedAt, allocateBefore, settleBefore }` plus two opposite `transferLegs` (Alice
pays DEMO-USD to Bob; Bob delivers DEMO-BOND to Alice). A non-selectable `registry`
party administers both instruments; the venue (executor) and the registry are
distinct roles.

## Demo flows

1. Connect and create a trade. As the Venue, click Connect Wallet (the console
   adapter, themed by the gold family). Enter a USD amount and a BOND amount and click
   New trade: a new allocation request appears.
2. Alice allocates her USD leg. Switch to Alice. Her leg shows a `CostPreview` before
   confirm; Allocate my leg composes the allocation spec from the request and submits
   it through `useAllocationInstruction`. Her USD holdings drop and a change holding is
   written back.
3. Bob allocates his BOND leg. Switch to Bob and allocate his leg the same way.
4. The venue settles atomically. Switch to the Venue. The trade shows 2/2 allocated
   and Settle is enabled. Settle moves both legs in one step: Bob receives the USD,
   Alice receives the BOND, and the balances swap.
5. Withdraw then settle shows the failure. Allocate a leg, then withdraw it from My
   allocations. The venue's Settle is disabled while a leg is unmatched; the store
   itself throws a descriptive all-or-nothing error (listing the missing leg ids) that
   moves nothing.
6. Bob rejects a trade. Switch to Bob and Reject an open trade through
   `useAllocationRequestAction` (action `reject`, actor = Bob). Any allocations for it
   are released and the trade is dropped.
7. The venue withdraws a trade. As the Venue, Withdraw trade through
   `useAllocationRequestAction` (action `withdraw`), releasing allocations and dropping
   the trade.

The venue can also Cancel allocation on a matched leg (`useAllocationAction`, action
`cancel`) for the abort path that releases a counterparty's backing early.

## Party-scoped caching

Every hook folds the current demo party into its `key` (for example
`['dvp', 'holdings', party]`), so each party's data is cached independently. Switching
parties never shows another party's cached data. Invalidation after every write goes
through the exported `partyLayerKeys` factories (see `src/lib/invalidate.ts`),
refreshing the trades (`allocationRequests`), allocations (`tokenAllocations`), and
holdings (`tokenHoldings`).

## Atomic settle

The venue's settle mirrors the official trading-app `OTCTrade_Settle`: it verifies an
expected allocation exists for EVERY leg (a spec match on settlement, transfer leg id,
and transfer leg) and that `now < settleBefore`, then executes ALL legs in ONE store
mutation. If any leg is unallocated or the deadline has passed it throws BEFORE any
asset moves, listing the missing leg ids. This is a dApp-specific trade choice, so the
UI wires it through the generic `useChoice`: a real venue settles atomically via its
trade contract's choice whose body exercises `Allocation_ExecuteTransfer` per leg in a
single transaction, which is exactly why this is `useChoice` and not the
per-allocation typed hook.

The comparator that decides whether an allocation satisfies a request leg is
`allocationMatchesRequestLeg` from `@partylayer/react/query` (decimal-as-string
equality without float conversion), used by both the store and the venue view via the
thin adapter in `src/lib/match.ts`.

## Decimal handling

Amounts are decimal strings end to end (never JS numbers), matching the CIP-0056
`Decimal` convention. The demo store simplifies arithmetic to two decimal places using
bigint cents (`src/lib/format.ts`); a real dApp handling arbitrary precision should use
a decimal library.

## Real mode

To wire this against a live validator and registry, replace the demo backend's
fetchers. The hooks and the UI stay exactly as they are.

- Discovery. Read the trades a party can act on with an ACS interface-filter query for
  `Splice.Api.Token.AllocationRequestV1:AllocationRequest`, mapped into
  `TokenAllocationRequestRef`. Implementations SHOULD make at least all transfer-leg
  senders observers of the request, which is how wallets discover it.
- Allocate a leg (`useAllocationInstruction`). Compose the allocation spec from the
  request (`settlement`, `transferLegId`, `transferLeg`), then in the `submit` fetcher
  fetch the registry's allocation-factory (its `choiceContext` and
  `disclosedContracts`), fill `extraArgs.context`, and exercise
  `AllocationFactory_Allocate` with the disclosed contracts. `expectedAdmin` must come
  from a trusted source (e.g. a read against your own participant).
- Respond to a request (`useAllocationRequestAction`). `AllocationRequest_Reject` (with
  `actor`) and `AllocationRequest_Withdraw` are called with an EMPTY choice context per
  the standard, so the `submit` fetcher exercises directly on the request cid with
  `extraArgs { context: empty, meta }`, no registry fetch.
- Act on a funded allocation (`useAllocationAction`). Withdraw and cancel go through
  the registry's per-action choice contexts on the allocation cid.
- Settle. The venue's trade app exercises its own settle choice, whose body runs
  `Allocation_ExecuteTransfer` for every leg in one transaction. The official Splice
  token-standard trading-app example is the canonical reference for this flow.
