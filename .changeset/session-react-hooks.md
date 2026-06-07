---
"@partylayer/react": minor
"@partylayer/provider": minor
---

Add framework-agnostic session React hooks (Step 6b), additively.

- **@partylayer/react**: new `useAccount()` and `useAccountEffect()` hooks
  (wagmi parity) backed by the `@partylayer/session` core via
  `useSyncExternalStore` (SSR-safe). `PartyLayerProvider` now creates and
  shares a `SessionStore` (CIP-0103 provider + a new SSR-safe
  `createLocalStorage()` adapter), running `init()` on mount and `destroy()`
  on unmount. The existing `useSession` hook is **unchanged** (still
  SDK-layer, returns `Session | null`); the two coexist until the M2 react v2
  unification.
- **@partylayer/provider**: export the existing `BridgeableClient` type
  (`export type { BridgeableClient }`) — additive, no runtime change.

All changes are additive and backward-compatible (no existing export removed,
renamed, retyped, or behaviorally changed).

NOTE: `@partylayer/react` now depends on `@partylayer/session` via
`workspace:^`. `@partylayer/session` is still private (0.1.0) and publishes at
the M1 cut — **do not publish `@partylayer/react` until `@partylayer/session`
is published; both go out together at M1.**
