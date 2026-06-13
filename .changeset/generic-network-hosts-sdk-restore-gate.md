---
'@partylayer/sdk': minor
---

Add a network gate to session restore. `restoreSession` now validates the persisted session's network (our network-aware envelope) against the configured network BEFORE any adapter handoff: under enforcement (`guard`/`strict`) a cross-network session is refused and cleared; under `off` it is restored but flagged with `networkMismatch`.

This closes a silent stale-network restore: a discovery-adapter session has no `adapter.restore`, so it took the "restore as-is" path with no network check — reviving e.g. a devnet identity on a `network="mainnet"` app (the official adapter's restore is silent, so the connect-time mismatch check never fired). Generic for any wallet whose adapter lacks `restore`.
