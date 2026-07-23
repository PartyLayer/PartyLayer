# PartyLayer Tokenization example

The M3 **Tokenization vertical**: a single-page dApp that composes the full
CIP-0056 (Canton Token Standard) helper surface from `@partylayer/react`, the UI
primitives, and the theme families against a **typed demo backend**. It is built
in-repo (workspace deps) to validate the new react API in composition before any
npm publish.

Everything runs on an in-memory demo backend (typed fixtures behind a small
`TokenizationBackend` interface), so every hook is exercised for real (loading,
success, error, invalidation) without a live ledger. **Model 2 throughout:**
PartyLayer owns none of the transport; the dApp supplies every read and submit
fetcher, and the hooks type the request and wrap the query or mutation.

## Run it

```bash
pnpm install
pnpm --filter partylayer-tokenization dev
```

Not deployed (Vercel stays demo-only).

## What is on screen

A header with the connect UI, a **demo-party switcher** (issuer / alice / bob), a
synchronizer picker, and a light/dark toggle; then five section cards:

| Section | Hook(s) exercised |
| --- | --- |
| Holdings | `useTokenHoldings` |
| Transfer | `useTransferInstruction` (plus `CostPreview` + `TransactionToast`) |
| Incoming | `useDamlContract` (read) + `useTransferInstructionAction` |
| Issuer | `useDamlContract` (instrument, supply, refs) + `useChoice` (mint, freeze) |
| Allocations | `useTokenAllocations` + `useAllocationInstruction` + `useAllocationAction` |

All six CIP-0056 hooks are mounted and exercised, plus the two generic hooks
(`useDamlContract`, `useChoice`) for the reads and registry-specific writes the
typed hooks do not cover.

## Demo flows

1. **Connect.** Click Connect Wallet in the header. The console adapter is
   registered, so the wallet modal renders themed by the teal family. The sections
   below are driven by the demo-party switcher, not the connection.
2. **View holdings with a frozen lock.** As Alice, the Holdings card shows two
   holdings; one carries a lock and renders a "Locked: frozen by issuer" badge.
3. **Transfer with a cost preview and a toast.** In Transfer, pick a receiver and
   an amount. A `CostPreview` shows the fee before you confirm; confirming drives a
   `TransactionToast` from pending to success. The transfer initiates a pending
   instruction and debits the sender; both sides refresh after invalidation.
4. **Accept the incoming transfer.** Switch the demo party to the receiver (Bob).
   The Incoming card shows the pending transfer; Accept completes it and credits
   the receiver, and the pending item disappears.
5. **Issuer mints.** Switch to Issuer, enter a party and an amount under Mint. The
   total supply and the target party's holdings update.
6. **Issuer freezes.** As Issuer, pick a target party and toggle Freeze / Unfreeze
   on a holding; the lock badge appears and the holding becomes unspendable in
   transfers.
7. **Error path.** As any party, try to transfer more than the unlocked balance.
   The submit rejects and the toast renders the error message.

## Party-scoped caching

Every hook call folds the current demo party into its `key` (for example
`key: ['tokenization', 'holdings', party]`), so each party's data is cached
independently. Switching parties never shows another party's cached data: a party
you have not loaded shows a loading skeleton, and a party you have loaded shows its
own data. This validates the wallet-switch-safe caching design end to end.

Note on invalidation: the hooks nest your `key` inside their own key factory, so
the real TanStack query key is `partyLayerKeys.tokenHoldings({ key })`, not the raw
`key` you passed. To invalidate after a write, import `partyLayerKeys` from
`@partylayer/react/query` and match on the factory (see `src/lib/invalidate.ts`).

## Decimal handling

Amounts are decimal strings end to end (never JS numbers), matching the CIP-0056
`Decimal` convention. The demo store simplifies arithmetic to two decimal places
using bigint cents (`src/lib/format.ts`); a real dApp handling arbitrary precision
should use a decimal library instead of this two-place shortcut.

## Real mode

To wire this against a live validator and registry, replace the demo backend's
fetchers. The hooks and the UI stay exactly as they are; only the fetchers change.

**Reads (holdings, allocations).** Query your validator's active-contracts (ACS)
endpoint with an interface filter and map each contract's interface view into the
typed shape:

- holdings: interface filter `Splice.Api.Token.HoldingV1:Holding`, map each view
  into `TokenHolding` (keep the contract id alongside the view; see the finding
  below);
- allocations: interface filter `Splice.Api.Token.AllocationV1:Allocation`, map
  into `TokenAllocation`.

**Transfer initiation (`useTransferInstruction`).** The registry flow is
off-ledger and not standardized, so it lives in your `submit` fetcher: gather the
sender's `inputHoldingCids`, POST the registry's transfer-instruction
transfer-factory endpoint to get the `factoryId`, `choiceContext`, and
`disclosedContracts`, fill `extraArgs.context`, then exercise
`TransferFactory_Transfer` on the factory with the `disclosedContracts`.

**Transfer completion (`useTransferInstructionAction`).** For accept, reject, or
withdraw, fetch the per-action choice context from the registry, fill `extraArgs`,
and exercise the choice on the instruction contract id with the
`disclosedContracts`.

**Allocation create and act (`useAllocationInstruction`, `useAllocationAction`).**
Mirror the transfer flow against the registry's allocation-instruction factory
endpoint and the per-action choice contexts for `Allocation_ExecuteTransfer`,
`Allocation_Cancel`, and `Allocation_Withdraw`.

**Issuer writes (mint, freeze).** These are registry-specific admin operations,
shown here through the generic `useChoice` escape hatch. Real registries typically
expose issuance through the standard's `BurnMintV1`
(`BurnMintFactory_BurnMint`, which returns `outputCids`) or a custom admin choice;
the exact choice fields are registry-defined.

The official Splice token-standard CLI is the canonical reference for these
registry flows.

## API findings

Building this example surfaced a few composition frictions in the public API. They
did not block the app (each was worked around cleanly), but they are reported for
the API review:

1. **`toTrafficCost` is not re-exported from `@partylayer/react`.** Composing a
   `CostPreview` estimate needs the `TrafficCost` constructor, which lives in
   `@partylayer/core`, so the example pulls in a second package for one call.
2. **`TokenHolding` and `TokenAllocation` carry no contract id.** The standard
   views omit the cid, but transfers need `inputHoldingCids` and per-holding /
   per-allocation actions need to identify a contract, so the dApp must track the
   cid alongside the view (a real ACS query returns `{ contractId, view }`). The
   example keeps `{ cid, holding }` refs for exactly this reason.
3. **No typed instruction view.** There is no exported view for a pending
   `TransferInstruction`, so the incoming list is an app-level model composed from
   `TokenTransfer` + `TransferInstructionStatus` and read through the generic
   `useDamlContract`.
4. **The `key` prop is not the query key.** The hooks nest `key` inside their own
   key factory, so invalidation must go through `partyLayerKeys`, not the raw
   `key`. The `key` prop reads like it is the cache key, but it is one level down.
