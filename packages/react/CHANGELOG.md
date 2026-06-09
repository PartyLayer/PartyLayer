# @partylayer/react

## 0.6.0

### Minor Changes

- b340c67: feat(react): optional `walletOrder` on PartyLayerKit/WalletModal to control connect-modal wallet order

  New OPTIONAL `walletOrder?: readonly string[]` prop on both `WalletModal` and
  `PartyLayerKit` (threaded via context, mirroring `walletIcons`). When provided,
  the modal sorts wallets WITHIN the existing CIP-0103 Native / Available sections
  by the given id order (case-insensitive, `cip0103:` prefix stripped; unlisted
  wallets fall to the end), preserving the section structure. When omitted, the
  discovered order is unchanged — fully backward-compatible. RainbowKit `wallets`
  parity.

### Patch Changes

- 2c4c10c: feat(react): surface a network-mismatch state + switch-network message in the connect modal

  Adds a `network-mismatch` modal view: on a 'guard'/'off' connect that flags
  `session.networkMismatch`, the modal shows "Your wallet is on X, this app
  requires Y — switch and reconnect" with Reconnect / All Wallets actions. The
  'strict' path (NetworkMismatchError) is handled by the existing error view via a
  new `getErrorMessage` case. No new public props.

- Updated dependencies [2c4c10c]
  - @partylayer/sdk@0.6.0
  - @partylayer/registry-client@0.3.3
  - @partylayer/session@0.2.1

## 0.5.0

### Minor Changes

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

- 53b1714: WalletConnect / QR-only wallets now show a scannable QR **in the connect modal**
  out of the box (no integrator wiring), with a mobile deep-link, and the official
  dapp-sdk blank `about:blank` popup is suppressed.
  - **core / sdk:** add an optional `onDisplayUri(uri)` callback to the adapter
    `connect()` options and to `ConnectOptions`. Adapters call it with a
    pairing/display URI (e.g. a WalletConnect `wc:` URI) the moment one is
    produced, before approval; the connect UI uses it to render a QR / deep-link.
    Backward-compatible (optional).
  - **adapter-walletconnect:** the official adapter's `onUri` is now always
    wrapped so the pairing URI is fanned out to BOTH the integrator's
    `config.onUri` AND the per-connect `onDisplayUri` — no hand-wiring needed. The
    adapter also narrowly intercepts the official adapter's blank
    `window.open('', 'wallet-popup')` during connect (no config flag exists to
    disable it) and restores `window.open` afterward.
  - **react:** the modal renders the WC QR itself. `handleWalletClick` passes
    `onDisplayUri` for non-dual (QR-only / remote-signer) wallets and enters the
    QR view only once a URI actually arrives (wallets that draw their own QR are
    unaffected). QR generated via `qrcode` (new dependency). Copy is
    wallet-agnostic for the generic WalletConnect entry ("Scan with your Canton
    wallet" / "Open wallet"). The dual-transport (Console) extension + placeholder
    QR-fallback flow is unchanged.

### Patch Changes

- c1d4763: `WalletModal`'s `onConnect` prop is now **optional** (`onConnect?: (sessionId:
string) => void`). A connect modal shouldn't require a connect callback — it
  already self-closes via `onClose` on success, and the session is observable via
  `useSession()` / `useAccount()`. The success path now calls it conditionally
  (`onConnect?.(session.sessionId)`). Backward-compatible widening (existing
  callers passing `onConnect` are unaffected); the documented minimal
  `<WalletModal isOpen onClose />` snippet now compiles. README reference updated
  to the real signature (`(sessionId: string) => void`).
- Updated dependencies [8532f3d]
- Updated dependencies [c18a275]
- Updated dependencies [53b1714]
  - @partylayer/sdk@0.5.0
  - @partylayer/session@0.2.0
  - @partylayer/registry-client@0.3.2

## 0.4.5

### Patch Changes

- Repair the transitive `@partylayer/core` dependency reference.

  `0.4.4` itself does not directly import any new core symbols, but it
  depends transitively on the broken `sdk@0.4.0` and `registry-client@0.3.0`.
  Republishing ensures workspace dependency resolution points to the fixed
  versions.

- Updated dependencies
- Updated dependencies
  - @partylayer/registry-client@0.3.1
  - @partylayer/sdk@0.4.1

## 0.4.4

### Patch Changes

- 7770870: Registry-driven detection and adapter-aware picker readiness.

  `@partylayer/core` and `@partylayer/registry-client` introduce a multi-signal `providerDetection` schema on `RegistryWalletEntry`. Registry entries can declare a transport plus an ordered list of matcher rules (`domain`, `exact`, `prefix`) over the live CIP-0103 `status` shape — `kernel.url`, `kernel.userUrl`, `kernel.id`. This lets new CIP-0103 wallets be added to the ecosystem through a registry JSON update without an SDK code change, and lets the SDK identify a wallet by stable signals (vendor domain) when the per-install identity field (`kernel.id`) varies. The matcher engine is OR-combined, case-insensitive on domains, case-sensitive on exact values, and short-circuits on first match. 33 unit tests cover the matcher semantics.

  The registry-client schema also gains an optional `RegistryWalletEntry.beta?: boolean` flag and a `RegistryWalletEntry.cip0103?: { native, evidence, since }` marker. The picker UI uses `cip0103.native` to surface CIP-0103-native wallets in a dedicated section regardless of install state. The optional `beta` flag, when present on any entry, propagates through `WalletInfo.metadata.beta = 'true'` so UIs can render a "Beta" badge generically.

  `@partylayer/sdk` re-exports the detection helpers (`isCip0103Native`, `Cip0103Support`, `ProviderDetection`, `matchesProviderDetection`) and adds `getAdapter(walletId)` for adapter-aware UI integrations that need to probe `detectInstalled()` directly. The `tsup` external list grew to externalise all built-in adapter packages — the bundled SDK dist drops from ~80 KB ESM to ~30 KB ESM with no public API change.

  `@partylayer/react` renders the optional Beta badge in the wallet picker modal from `WalletInfo.metadata.beta`. The picker also adds an adapter-aware NATIVE readiness probe: when an adapter implements `detectInstalled()`, the picker reflects its result rather than guessing from a static install hint.

- Updated dependencies [7770870]
  - @partylayer/sdk@0.4.0
  - @partylayer/registry-client@0.3.0

## 0.2.8

### Patch Changes

- fix: resolve workspace:\* protocol in published packages and add ledgerApi support
- Updated dependencies
  - @partylayer/sdk@0.2.8
  - @partylayer/registry-client@0.2.6

## 0.2.6

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/sdk@0.2.6
  - @partylayer/registry-client@0.2.4

## 0.2.4

### Patch Changes

- Updated dependencies
  - @partylayer/sdk@0.2.4

## 0.2.3

### Patch Changes

- Updated dependencies
  - @partylayer/sdk@0.2.3

## 0.2.2

### Patch Changes

- Update GitHub repository URLs to cayvox/CantonConnect
- Updated dependencies
  - @partylayer/sdk@0.2.2
  - @partylayer/registry-client@0.2.2

## 0.2.1

### Patch Changes

- Add comprehensive README documentation for npm package pages
- Updated dependencies
  - @partylayer/sdk@0.2.1
  - @partylayer/registry-client@0.2.1

## 0.2.0

### Minor Changes

- Initial public release of CantonConnect SDK.

  CantonConnect provides a WalletConnect-like experience for Canton Network dApps, enabling seamless integration with multiple Canton wallets through a unified API.

  Features:
  - Support for Console Wallet, 5N Loop, Cantor8, and Bron wallets
  - React hooks and components for easy integration
  - TypeScript support with full type definitions
  - Secure session management with encrypted storage
  - Event-driven architecture for real-time updates

### Patch Changes

- Updated dependencies
  - @partylayer/registry-client@0.2.0
  - @partylayer/sdk@0.2.0
