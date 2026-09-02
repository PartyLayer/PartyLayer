---
"@partylayer/core": major
"@partylayer/sdk": major
"@partylayer/provider": major
"@partylayer/react": major
"@partylayer/vue": major
"@partylayer/adapter-bron": minor
"@partylayer/adapter-loop": minor
---

**Breaking:** `transactionHash` is now optional. An adapter with no hash to report reports nothing.

## Why this is breaking, by the rules

`docs/releasing.md` lists "Changing method signatures (parameters, return types)" as a breaking change. `TxReceipt.transactionHash` and `SignedTransaction.transactionHash` go from `TransactionHash` to `TransactionHash | undefined`, so every consumer reading them must now handle absence. That is a breaking change to a published interface and it is labelled as one, not softened into a minor because these are 0.x packages and the tooling would have allowed it.

Also optional, for the same reason and from the same source: `TxStatusUpdate.txId` (core) and `TxStatusEvent.txId` (sdk).

## Who is affected

The compiler enumerated this, not a grep. Every site that had to change:

- `@partylayer/sdk` — the three `tx:status` emissions in `client.ts` (sign, submit, transfer)
- `@partylayer/provider` — `BridgeableClient`'s structural type, and the `signed` / `executed` CIP-0103 payloads
- `@partylayer/react` and `@partylayer/vue` — the `TransactionToast` detail line

If you read `receipt.transactionHash`, you now need to handle `undefined`. If you want a ledger identifier, prefer `receipt.updateId`: it is the ledger's own id for the committed update, and several wallets report a real one while having no hash at all.

**Watch for `String(receipt.transactionHash)`.** That pattern compiles fine and renders the literal text `"undefined"` — a new placeholder created by the very change that removed the old ones. Three such sites existed inside this repository and are fixed here; check yours.

## The finding this comes from

**A required field with no honest value is a defect factory.**

Nine sites across five adapters manufactured a transaction hash: `tx_<now>_<random>`, `tx_<now>`, `'pending'` (three times), `''`, a command id, a signature. Not one of them was a fallback anybody designed. Every one existed because the type demanded a value the code path could not produce, and the adapter had nowhere to put nothing.

Two of the nine were found only while making this change — Bron's, which an earlier survey of this exact problem had missed because they were ternaries rather than `??` chains. That is the argument in miniature: fixing the sites one at a time finds the ones you already know how to look for, and leaving the field required guarantees the next adapter writes a tenth.

## Also fixed here

- **Bron** omits `transactionHash` instead of reporting the word `'pending'` as one (two sites).
- **Loop** omits it instead of reporting the command id under it. The command id is still reported as `commandId`, which is true of it. A real value under a wrong name is the same error as a fabricated one for anyone reading the field by its name.
