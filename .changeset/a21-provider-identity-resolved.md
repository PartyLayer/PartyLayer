---
"@partylayer/provider": patch
---

A2.1: `discoverProviders` now resolves injected (`window.canton` scan) entries to
their REAL identity and tags `identityResolved` (additive):

- when a sync `provider.id` or a `status().provider.id` probe yields a real id,
  the entry's `id` IS that id (not the `'canton'` scan path id) and
  `identityResolved: true` — so the SDK identity-bridge matches the right wallet
  (e.g. Console's bare slot status() → `lpnf…` → bridges to console);
- when neither resolves (identity-less bare slot), the entry keeps the path id
  and is `identityResolved: false` so consumers drop it.

Announce-discovered entries are always `identityResolved: true` (the announce id
is the real id). Fixes the live phantom "Canton Wallet" (`browser:ext:canton`)
listing on partylayer.xyz post-A2, which came from the path id `'canton'` leaking
through as a wallet identity.
