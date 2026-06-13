# @partylayer/provider

## 0.2.3

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.2.2

### Patch Changes

- 27e5b68: A2 (G4): `discoverAnnouncedProviders` now routes the default announce→provider
  factory to `target ?? id` (canonical provider.md: `target` defaults to `id` when
  omitted). An announce without an explicit `target` still binds the announcing
  wallet's own extension channel — never a shared/undefined slot.
- 76972de: A2.1: `discoverProviders` now resolves injected (`window.canton` scan) entries to
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

## 0.2.1

### Patch Changes

- 9642aee: refactor(provider): re-export CAIP-2 utils from @partylayer/core (no API change)

  `CANTON_NETWORKS`, `toCAIP2Network`, `fromCAIP2Network`, `isValidCAIP2` now live
  in @partylayer/core; provider re-exports them so its public surface and
  bridge.ts imports are unchanged.

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.2.0

### Minor Changes

- 42c862d: Add `canton:announceProvider` (EIP-6963-style) wallet discovery.

  Some Canton wallets (notably **Send**) do not reliably expose `window.canton`:
  when another wallet (e.g. Console) owns the single `window.canton` slot, the
  announce wallet was missed. Discovery now ALSO listens for the
  `canton:announceProvider` handshake, so announce wallets are found regardless
  of who owns `window.canton`.

  New additive exports on `@partylayer/provider`:
  - `discoverAnnouncedProviders(options?)` — dispatches `canton:requestProvider`
    and resolves each `canton:announceProvider` reply to a working CIP-0103
    provider.
  - `discoverProviders(options?)` — merges the existing synchronous
    `window.canton` scan with announce results, **deduped by stable provider id**
    (a wallet reachable both ways — e.g. Console — appears exactly once). The
    injected entry's stable id is resolved sync-id → capped read-only `status()`
    probe (`provider.id`, no popup) → path id, since live `window.canton`
    (Console) exposes no top-level `id`; announce entries are keyed by their own
    id and are NOT status-probed, so an offline announce wallet (Send) never
    blocks discovery. The direct `window.canton` provider wins the dedup over the
    announce shim.
  - `createExtensionChannelProvider` only accepts responses posted on the page's
    own `window` and (when available) matching origin.
  - `createExtensionChannelProvider(options?)` — a self-contained CIP-0103
    provider over the splice-wallet `target` postMessage channel (the transport
    for announce wallets). `discoverAnnouncedProviders` uses it by default;
    `options.createProvider` is injectable to substitute another implementation.
  - `DiscoveredProvider.icon?` (new optional field) and the `AnnouncedWallet`,
    `AnnounceDiscoveryOptions`, `ExtensionChannelOptions` types.

  The `target` postMessage handshake is implemented natively (mirroring the
  splice-wallet protocol) rather than via `@canton-network/dapp-sdk`: that
  package's single bundled entry statically imports `@walletconnect/sign-client`
  (an uninstalled optional peer), which breaks every downstream webpack/Next
  build that pulls `@partylayer/provider` into its graph — so it is deliberately
  NOT a dependency. No external runtime dependency is added.

  `discoverInjectedProviders()` (the `window.canton` scan) is unchanged, as is
  its return type. No behavior change to existing discovery, `adapter-send`, or
  any other adapter.

- c18a275: Add framework-agnostic session React hooks (Step 6b), additively.
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

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.1.7

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.3.0

## 0.1.3

### Patch Changes

- fix: resolve workspace:\* protocol in published packages and add ledgerApi support
- Updated dependencies
  - @partylayer/core@0.2.6

## 0.1.1

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/core@0.2.4
