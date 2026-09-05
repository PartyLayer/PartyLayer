---
"@partylayer/adapter-loop": minor
---

Raise Loop's transaction outcome as an event instead of discarding it, and make
the `events` capability true.

Minor rather than patch: this adds public API — `LoopAdapter.on()` and the
`LoopAdapterEvent` type. Additive and non-breaking, but a new surface consumers
can depend on is not a patch, even when the reason for adding it is a fix.

`onTransactionUpdate` went to `ctx.logger.debug` and nowhere else. Per the
vendor's own README (identical in 0.13.2 and 0.13.4):

> `submitTransaction` is the default async path. It returns the submission
> result first (including `command_id` and `submission_id`), then the ledger
> update arrives later via `onTransactionUpdate` with `update_id` and
> `update_data`. On success it also includes `update_data` (ledger transaction
> tree); on failure it includes `status: "failed"` and `error.error_message`.

Our `submitTransaction()` uses that async path, so its receipt is a submission
acknowledgement, not an outcome. Discarding the hook meant a consumer submitting
through Loop could never learn whether the transaction committed, or why it
failed. The payload is now mapped onto core's transaction vocabulary
(`committed` / `failed` / `submitted`, with `update_id` as the transaction id and
`update_data` passed through untouched) and dispatched to subscribers.

`getCapabilities()` declared `events` while the adapter contained no dispatch of
any kind and the Loop provider exposes no subscription surface — no `on`, no
`addListener`, in 0.13.2 or 0.13.4. By this repo's own rule (`announce-adapter.ts`
pushes `events` only when a provider `on` exists) that claim was false. Rather
than drop the capability, the adapter now provides the surface that makes it
true: `on('txStatus', handler)`, matching the Console adapter's signature so a
consumer writes the same code against either wallet.

Scoped honestly to ONE event. Loop's SDK defines four `ProviderHooks`, but only
`onTransactionUpdate` is reachable by a dApp: `loop.init()` accepts `onAccept`,
`onReject` and `onTransactionUpdate` and nothing else, while the full
`ProviderHooks` is a `Provider` constructor parameter held in a `private hooks`
field with no setter — and the SDK builds the Provider itself before handing it
to `onAccept`. `sessionExpired` and a generic `error` channel are therefore not
declared: we could never raise them.
