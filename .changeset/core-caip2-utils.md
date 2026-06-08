---
"@partylayer/core": minor
---

feat(core): add CAIP-2 network utilities (CANTON_NETWORKS, toCAIP2Network, fromCAIP2Network, isValidCAIP2)

These moved from @partylayer/core's consumer (@partylayer/provider) into core so
the lower adapter layer can derive a WalletConnect CAIP-2 chain from a
PartyLayer NetworkId without an illegal upward import. Additive — provider
re-exports them unchanged.
