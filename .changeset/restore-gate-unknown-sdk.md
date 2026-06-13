---
'@partylayer/sdk': minor
---

`GenericDiscoveryAdapter` now ignores an UNRECOGNIZED wallet-reported network and falls back to the dApp's configured `ctx.network`. Previously `session.network = reportedNetwork ?? account.networkId ?? ctx.network` let a non-null but unrecognized value win — popup/remote wallets (Walley) report `networkId: "canton:unknown"` on devnet, so the persisted `session.network` became `canton:unknown`, which is uninterpretable and (with the prior core fail-open) silently bypassed the network-mismatch gate, letting a devnet identity restore on a mainnet app.

Now the bridge picks the first RECOGNIZED of `[reportedNetwork, account.networkId, ctx.network]`, else `ctx.network`. So a Walley devnet connect records `session.network = 'devnet'` — correct, and the restore/connect/tx network-mismatch checks work normally (and stay silent on the legitimate same-network path). Pairs with the core `detectNetworkMismatch` hardening.
