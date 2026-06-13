---
'@partylayer/core': minor
---

`detectNetworkMismatch` no longer fails open on unrecognized networks. Previously it returned `null` (no mismatch) whenever either side was not a well-known Canton CAIP-2 id — so a wallet reporting an unknown network (e.g. `canton:unknown`, as popup/remote wallets like Walley do) could silently restore/transact against a DIFFERENT configured network.

New rule: normalize both (short→CAIP-2 where possible) then compare — EQUAL ⇒ no mismatch (including two equal unrecognized values, protecting a legitimate same-network restore), UNEQUAL ⇒ mismatch (including a recognized network vs an unrecognized-but-different one). Unparseable inputs fall back to a raw equality comparison, so an exotic-but-different network can never slip through. This is the generic safety half of the restore network-gate fix.

Also adds `isRecognizedNetwork(networkId)` — whether a value normalizes to a well-known Canton network (mainnet/testnet/devnet/local); `canton:unknown`, other namespaces, and unparseable values return false. Used by the SDK bridge to decide whether to trust a wallet-reported network.
