---
"@partylayer/provider": minor
"@partylayer/adapter-send": minor
"@partylayer/sdk": patch
---

Fix the announce-discovery race: a wallet that announces (`canton:announceProvider`) **after** the one-shot request window — or on inject before any request — was missed, surfacing as `Wallet "…" did not announce`.

- **@partylayer/provider** (additive): new `subscribeAnnouncedProviders(onProvider, opts)` — a PERSISTENT (EIP-6963-style) announce subscription that captures late and inject-time announces until the returned unsubscribe runs — and `waitForAnnouncedProvider(predicate, { timeoutMs })`, which resolves the moment a matching announce arrives (vs a fixed window). The existing one-shot `discoverAnnouncedProviders` / `discoverProviders` are **unchanged**.
- **@partylayer/sdk** (patch): the client mounts one persistent accumulator at construction (read by `aggregateAnnouncedWallets`, torn down in `destroy()`), so a late/inject-time announce surfaces in `listWallets()`. No public API change.
- **@partylayer/adapter-send** (minor): `SendProvider` resolves its channel via resolve-on-arrival (`waitForProvider`), so a late Send announce is no longer missed. Detect and connect now use **split bounds** mirroring the EIP-6963 reactive-readiness model — `detectInstalled`/`isInstalled` waits ~1000ms (best-effort readiness, won't stall the UI when Send is absent; the persistent accumulator self-corrects a later announce), while the deliberate connect/request path waits 3000ms. New `SendProviderOptions.detectTimeoutMs` (default 1000) alongside `announceTimeoutMs` (default 3000). The legacy `SendProviderOptions.discover` hook is **kept (deprecated)**, wrapped for backward compatibility.

Both the Send connect path and the generic announce path now benefit from the shared persistent primitive. Listeners are removed on teardown (no leak).
