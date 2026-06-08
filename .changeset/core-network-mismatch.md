---
"@partylayer/core": minor
---

feat(core): NetworkMismatchError + detectNetworkMismatch + Session.networkMismatch

- `NetworkMismatchError` (code `NETWORK_MISMATCH`, public `expected`/`actual`).
- `detectNetworkMismatch(expected, actual)` — conservative: returns the
  normalized `{expected, actual}` only for a confident, recognized,
  DIFFERENT-network mismatch; `null` otherwise (never a false positive).
- Optional `Session.networkMismatch?: { expected; actual }` (additive).
