---
"@partylayer/adapter-walley": minor
"@partylayer/sdk": minor
---

Add `@partylayer/adapter-walley`, a built-in adapter for the
[Walley](https://walley.cc) self-custodial Canton wallet. Walley is a hosted web
wallet reached through a popup JSON-RPC bridge; the adapter mirrors the wire
protocol of `@k2flabs/walley-dapp-sdk` (connect / signMessage /
prepareExecuteAndWait over `postMessage`, origin-checked) and exposes it through
PartyLayer's `WalletAdapter` contract. Like other approve-in-wallet wallets it
fuses signing and submission via `submitTransaction`; `ledgerApi` proxies
read-only Ledger API calls through the wallet's bearer-token proxy. Registered in
`getBuiltinAdapters()` and listed in the beta registry channel.
