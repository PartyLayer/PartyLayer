---
"@partylayer/sdk": minor
"@partylayer/react": patch
---

Reactive wallet list — late-announcing wallets now appear LIVE in the picker (no manual refresh), completing the UX of the announce race fix.

Previously the persistent accumulator CAPTURED a late `canton:announceProvider` (data layer), but `listWallets()` returned a stale one-shot snapshot and the React picker only loaded once on mount — so a wallet injecting after the modal opened never surfaced.

- **@partylayer/sdk** (minor, additive): new `wallets:changed` event (signal-only `{ type: 'wallets:changed'; reason: 'announced' }`). When the announce accumulator gains a wallet, the client now invalidates the one-shot announce cache (the same invalidation as `refreshDiscovery`) and emits a **debounced** (~50ms, coalesces a burst into one) `wallets:changed`. The authoritative read stays `listWallets()` (which does registry-merge + gating + filtering), mirroring EIP-6963/mipd. `warmPlans` (popup gesture-sync) is a disjoint cache and is untouched; `listWallets()`/`refreshDiscovery()` signatures are unchanged; zero announces → no emit (byte-identical idle); the debounce timer + listener are torn down in `destroy()`.
- **@partylayer/react** (patch): `PartyLayerProvider` subscribes to `wallets:changed` and re-lists → `useWallets()` re-renders with the new wallet automatically. `useWallets()`'s signature is unchanged (still a pure context read); the one-shot mount load is preserved; SSR-safe (subscription inside the browser-only effect).
