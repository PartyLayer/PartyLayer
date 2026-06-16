---
"@partylayer/sdk": patch
---

Restore hardening for configured-announce wallets (Phase 2; client-only, additive). A session revived AS-IS at construction — which happens for a `transport:'announce'` wallet whose adapter is created lazily in `listWallets` (so it isn't registered at ctor restore time) — is now re-validated by a LIVE `status()` probe the moment that adapter is created, matching bespoke Send's ctor-time probe.

Mechanism: a private `activeSessionNeedsProbe` flag is set on the as-is restore path (cleared on a live-probe restore and on fresh connect). When `aggregateAnnouncedWallets` creates the configured adapter for the active session's wallet, it runs `adapter.restore()` once — refreshing the session (emits `session:connected`) or, if the wallet disconnected between reloads, clearing the stale session (emits `session:expired`). Guarded (flag + walletId match + `restore` present) and wrapped in try/catch so a probe failure never breaks `listWallets`.

Byte-identical for fresh-connect sessions (flag false), bespoke-restored sessions (flag false), and no active session (guard). No public API change. `@partylayer/adapter-send` and the discovery/popup path are untouched.
