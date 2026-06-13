---
'@partylayer/registry-client': minor
---

Add the optional, additive `adapter.networkHosts` field (`NetworkHosts`) to registry wallet entries. For `transport: 'discovery-adapter'` wallets it maps each supported network to the wallet's host (e.g. `{devnet, testnet, mainnet}`); the generic SDK bridge resolves `networkHosts[activeNetwork]` at connect time so no wallet URL is hardcoded. `validateWalletEntry` now asserts the map shape when present (object of non-empty string hosts). Absent ⇒ unchanged behavior.
