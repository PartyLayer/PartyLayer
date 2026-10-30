---
"@partylayer/registry-client": patch
---

Re-verify persisted signed registry bytes against the current trust roots before using cache entries. Isolate persistent caches by registry URL/channel, ignore legacy boolean-only trust claims, and await cache initialization so a late storage read cannot overwrite fresher network state. Key rotation tests cover overlap, removal and persisted cache rejection.
