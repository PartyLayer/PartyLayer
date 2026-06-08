---
"@partylayer/provider": patch
---

refactor(provider): re-export CAIP-2 utils from @partylayer/core (no API change)

`CANTON_NETWORKS`, `toCAIP2Network`, `fromCAIP2Network`, `isValidCAIP2` now live
in @partylayer/core; provider re-exports them so its public surface and
bridge.ts imports are unchanged.
