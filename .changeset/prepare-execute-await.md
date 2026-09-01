---
"@partylayer/sdk": minor
---

Fix `submitTransaction` on the generic CIP-0103 paths returning a receipt of `undefined`s.

**Read this before upgrading: four wallets start returning real values where they previously returned `undefined`.**

Console, Send, Cauri and Walley now populate `updateId` and `transactionHash` on the `TxReceipt` from `submitTransaction`. Before this change those fields were `undefined` for every one of them. **Application code that branches on their absence will now take a path it never took** — an `if (!receipt.updateId)` fallback, a "pending" placeholder, a skipped block, a conditional render. Nothing was removed and no type changed, so this is a fix restoring intended behaviour rather than a breaking change, but it is a real change in what your code receives at runtime and it is worth grepping for.

**What was wrong.** CIP-0103 has two execute verbs, and the standard's own types (`@canton-network/core-wallet-dapp-rpc-client@1.4.0`) define them as:

```ts
PrepareExecute        = (params) => Promise<Null>
PrepareExecuteAndWait = (params) => Promise<PrepareExecuteAndWaitResult>
```

Both generic adapters called the first and read its result as though it were the second, casting a `Null` to a `TxReceipt`. Against a conformant wallet the caller received a receipt whose every field was `undefined`. It is also why several adapters invented `transactionHash` values: the interface asked for something the path could not produce.

**What changed.** `GenericAnnounceAdapter` and `GenericDiscoveryAdapter` now prefer `prepareExecuteAndWait` and read the real `updateId` and `completionOffset` out of its executed-transaction response.

**This is a negotiation, not a substitution, because one registry wallet proves it has to be.** OneSwap implements `prepareExecute` and rejects the awaited verb with `4200`; it is also the one wallet whose `prepareExecute` returns something usable. A straight substitution would have fixed four wallets and broken the fifth. So the adapter asks once per wallet, falls back to `prepareExecute` when — and only when — the wallet reports the method as unsupported (`4200` / `-32601`), and remembers the answer.

**Wallets without the awaited verb are unchanged.** They keep exactly today's behaviour, degraded rather than broken, and the adapter logs the reason once, naming the wallet and the missing method, so the cause is visible without interrupting the flow.

**It never submits twice.** A fallback issues a second submit, so it fires only when the wallet rejected the *method* and nothing reached the ledger. A user rejection, a timeout, or any uncoded failure re-throws instead. If the awaited verb succeeds but returns no update id, the response is returned as-is rather than retried — the transaction is already committed.

Adapters that never used the generic path (Nightly, Loop, Cantor8, Bron, and the bespoke Console/Send adapters) are untouched.
