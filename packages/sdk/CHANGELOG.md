# @partylayer/sdk

## 0.12.1

### Patch Changes

- 197627c: `GenericAnnounceAdapter` metadata parity (step 1/3 — `kernelId`, additive). When a configured announce wallet (`config.metadata`) returns a standard splice-wallet-kernel / CIP-0103 `status.kernel.id`, it is now included in `session.metadata.kernelId`. Generic (read from RPC status, not wallet-specific). Fully gated by the existing `metadataEnabled` check — a no-config / `metadata:false` adapter never builds metadata, so behavior is byte-identical; a `metadata:true` wallet whose status has no `kernel` simply omits the key. No public API change.

## 0.12.0

### Minor Changes

- 5fdc6e8: Grow `GenericAnnounceAdapter` to per-registry-entry-configurable capabilities (additive; nothing else changes).

  An announced wallet with a registry entry (`adapter.transport: 'announce'`) can now opt into the optional CIP-0103 surface via its `capabilities.events` + `adapter.config` — mirroring wagmi's optional-method model. New `AnnounceAdapterConfig` (`events`/`restore`/`ledgerApi`/`metadata`/`mapError`); each optional method is assigned only when configured, so `getCapabilities()` and feature-detection stay honest.
  - **events** — `on()` bridges the provider's CIP-0103 `txChanged` → adapter `txStatus`.
  - **restore** — silent `status()`/`getPrimaryAccount()` probe + expiry + party-match.
  - **ledgerApi** — proxy the standard CIP-0103 `ledgerApi` call.
  - **metadata** — richer `session.metadata` on connect when the provider returns it.
  - **mapError** — optional programmatic error-translation hook (falls through to the SDK's built-in standard EIP-1193/-1474 mapping).

  **Break-nothing / coexistence:** with no config the adapter is byte-identical (3 capabilities, minimal session). A KNOWN wallet with a registered bespoke adapter (e.g. Send) still hits the `adapters.has → continue` bridge branch — untouched. The discovery/popup path (`GenericDiscoveryAdapter`, `warmDiscoveryPlans`, gating, `warmPlans`) and `@partylayer/adapter-send` are not touched. API additive: optional ctor field + optional methods, 0 removed.

## 0.11.0

### Minor Changes

- 4f6fa01: Reactive wallet list — late-announcing wallets now appear LIVE in the picker (no manual refresh), completing the UX of the announce race fix.

  Previously the persistent accumulator CAPTURED a late `canton:announceProvider` (data layer), but `listWallets()` returned a stale one-shot snapshot and the React picker only loaded once on mount — so a wallet injecting after the modal opened never surfaced.
  - **@partylayer/sdk** (minor, additive): new `wallets:changed` event (signal-only `{ type: 'wallets:changed'; reason: 'announced' }`). When the announce accumulator gains a wallet, the client now invalidates the one-shot announce cache (the same invalidation as `refreshDiscovery`) and emits a **debounced** (~50ms, coalesces a burst into one) `wallets:changed`. The authoritative read stays `listWallets()` (which does registry-merge + gating + filtering), mirroring EIP-6963/mipd. `warmPlans` (popup gesture-sync) is a disjoint cache and is untouched; `listWallets()`/`refreshDiscovery()` signatures are unchanged; zero announces → no emit (byte-identical idle); the debounce timer + listener are torn down in `destroy()`.
  - **@partylayer/react** (patch): `PartyLayerProvider` subscribes to `wallets:changed` and re-lists → `useWallets()` re-renders with the new wallet automatically. `useWallets()`'s signature is unchanged (still a pure context read); the one-shot mount load is preserved; SSR-safe (subscription inside the browser-only effect).

## 0.10.2

### Patch Changes

- a3f2ea4: Fix the announce-discovery race: a wallet that announces (`canton:announceProvider`) **after** the one-shot request window — or on inject before any request — was missed, surfacing as `Wallet "…" did not announce`.
  - **@partylayer/provider** (additive): new `subscribeAnnouncedProviders(onProvider, opts)` — a PERSISTENT (EIP-6963-style) announce subscription that captures late and inject-time announces until the returned unsubscribe runs — and `waitForAnnouncedProvider(predicate, { timeoutMs })`, which resolves the moment a matching announce arrives (vs a fixed window). The existing one-shot `discoverAnnouncedProviders` / `discoverProviders` are **unchanged**.
  - **@partylayer/sdk** (patch): the client mounts one persistent accumulator at construction (read by `aggregateAnnouncedWallets`, torn down in `destroy()`), so a late/inject-time announce surfaces in `listWallets()`. No public API change.
  - **@partylayer/adapter-send** (minor): `SendProvider` resolves its channel via resolve-on-arrival (`waitForProvider`), so a late Send announce is no longer missed. Detect and connect now use **split bounds** mirroring the EIP-6963 reactive-readiness model — `detectInstalled`/`isInstalled` waits ~1000ms (best-effort readiness, won't stall the UI when Send is absent; the persistent accumulator self-corrects a later announce), while the deliberate connect/request path waits 3000ms. New `SendProviderOptions.detectTimeoutMs` (default 1000) alongside `announceTimeoutMs` (default 3000). The legacy `SendProviderOptions.discover` hook is **kept (deprecated)**, wrapped for backward compatibility.

  Both the Send connect path and the generic announce path now benefit from the shared persistent primitive. Listeners are removed on teardown (no leak).

- Updated dependencies [a3f2ea4]
  - @partylayer/provider@0.3.0
  - @partylayer/adapter-send@1.2.0

## 0.10.1

### Patch Changes

- 5546a90: Add `AdapterNotRegisteredError` — an actionable, catchable error when connecting to a popup/remote (`transport: 'discovery-adapter'`) wallet whose app-supplied provider adapter was never registered.

  Previously `connect({ walletId: 'walley' })` for a known-but-unwired discovery wallet threw a bare `WalletNotFoundError` ("Wallet 'walley' not found"), conflating a config gap with a missing wallet. Now the SDK throws `AdapterNotRegisteredError` (code `ADAPTER_NOT_REGISTERED`) with a generic, registry-derived message that tells you how to wire it: `adapters: [{ providerId, create }]`. Distinct from `WalletNotFoundError` so higher-level UIs (e.g. PartyLayerKit) can catch it specifically. Scoped strictly to `discovery-adapter` entries; truly-unknown wallets still throw `WalletNotFoundError`. Maps to JSON-RPC `INVALID_PARAMS` on the provider surface.

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0
  - @partylayer/provider@0.2.6
  - @partylayer/adapter-bron@0.2.16
  - @partylayer/adapter-cantor8@0.2.16
  - @partylayer/adapter-console@0.3.11
  - @partylayer/adapter-loop@0.3.13
  - @partylayer/adapter-nightly@0.2.15
  - @partylayer/adapter-send@1.1.5
  - @partylayer/registry-client@0.5.2

## 0.10.0

### Minor Changes

- bef0ac6: `GenericDiscoveryAdapter` now ignores an UNRECOGNIZED wallet-reported network and falls back to the dApp's configured `ctx.network`. Previously `session.network = reportedNetwork ?? account.networkId ?? ctx.network` let a non-null but unrecognized value win — popup/remote wallets (Walley) report `networkId: "canton:unknown"` on devnet, so the persisted `session.network` became `canton:unknown`, which is uninterpretable and (with the prior core fail-open) silently bypassed the network-mismatch gate, letting a devnet identity restore on a mainnet app.

  Now the bridge picks the first RECOGNIZED of `[reportedNetwork, account.networkId, ctx.network]`, else `ctx.network`. So a Walley devnet connect records `session.network = 'devnet'` — correct, and the restore/connect/tx network-mismatch checks work normally (and stay silent on the legitimate same-network path). Pairs with the core `detectNetworkMismatch` hardening.

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0
  - @partylayer/adapter-bron@0.2.15
  - @partylayer/adapter-cantor8@0.2.15
  - @partylayer/adapter-console@0.3.9
  - @partylayer/adapter-loop@0.3.12
  - @partylayer/adapter-nightly@0.2.14
  - @partylayer/adapter-send@1.1.4
  - @partylayer/provider@0.2.5
  - @partylayer/registry-client@0.5.1

## 0.9.0

### Minor Changes

- 3285ed8: Generic network-driven host resolution for discovery-adapter wallets. `config.adapters` now also accepts an `OfficialAdapterFactory` (`{ providerId, create(host) }`); the SDK bridges it via `GenericDiscoveryAdapter`, resolves `host = registryEntry.adapter.networkHosts[activeNetwork]` during the connect warm phase, and constructs the official adapter with that host — so an app sets `<PartyLayerKit network="mainnet">` and never hardcodes a wallet URL.

  Host resolution + official construction happen synchronously during warm-up (`resolveConnectPlan`), preserving the popup-safe gesture-survival invariant: the prepared/fast connect reaches `adapter.connect()` → `window.open` with no awaited ops. Pre-constructed instances keep working unchanged (explicit host overrides `networkHosts`). A wallet with no host for the active network fails with a clear, network-named error — never a silent wrong-network host.

- 3285ed8: Add a network gate to session restore. `restoreSession` now validates the persisted session's network (our network-aware envelope) against the configured network BEFORE any adapter handoff: under enforcement (`guard`/`strict`) a cross-network session is refused and cleared; under `off` it is restored but flagged with `networkMismatch`.

  This closes a silent stale-network restore: a discovery-adapter session has no `adapter.restore`, so it took the "restore as-is" path with no network check — reviving e.g. a devnet identity on a `network="mainnet"` app (the official adapter's restore is silent, so the connect-time mismatch check never fired). Generic for any wallet whose adapter lacks `restore`.

### Patch Changes

- Updated dependencies [3285ed8]
- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0
  - @partylayer/registry-client@0.5.0
  - @partylayer/adapter-bron@0.2.14
  - @partylayer/adapter-cantor8@0.2.14
  - @partylayer/adapter-console@0.3.8
  - @partylayer/adapter-loop@0.3.11
  - @partylayer/adapter-nightly@0.2.13
  - @partylayer/adapter-send@1.1.3
  - @partylayer/provider@0.2.4

## 0.8.0

### Minor Changes

- 6efe375: Add `GenericDiscoveryAdapter` — a generic bridge that hosts an app-supplied official `@canton-network/core-wallet-discovery` `ProviderAdapter` (e.g. Walley) as a standard wallet, with NO wallet-specific package and no `@canton-network/*` dependency. `config.adapters` now also accepts an `OfficialProviderAdapter`; the SDK auto-detects and wraps it. The official `provider()` is obtained lazily (SSR-safe) and `getCapabilities()` never reports `events` (popup/remote wallets expose the event surface but do not emit).

  Also adds a popup-safe connect fast-path: a new public `prepareConnect()` primitive plus background warm-up (on `listWallets`) so a popup/remote wallet's `window.open` is reached synchronously from the user gesture (no Safari popup-block). The normal injected/announce connect path is behavior-unchanged; cold-cache discovery connects fall back to it.

- 4c53396: `listWallets()` now hides `transport: 'discovery-adapter'` registry entries whose matching adapter is NOT registered. A discovery-adapter wallet's provider is supplied by the app (an official ProviderAdapter the SDK bridges under `toWalletId(providerId)`); without it the entry can only fail on click. So such an entry surfaces only when its adapter is present — preventing a broken wallet from appearing for consumers who didn't wire it. No-op when the registry is unavailable or has no discovery-adapter entries; normal (injected/announce) entries are never affected.
- adaff8e: Export `OfficialProviderAdapter` (type) and `isOfficialProviderAdapter` (guard) — the official `@canton-network/core-wallet-discovery` ProviderAdapter contract that `config.adapters` accepts and `GenericDiscoveryAdapter` bridges. Needed so consumers (and `@partylayer/react`'s Kit prop) can name the type they already pass.

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0
  - @partylayer/registry-client@0.4.0
  - @partylayer/adapter-bron@0.2.13
  - @partylayer/adapter-cantor8@0.2.13
  - @partylayer/adapter-console@0.3.7
  - @partylayer/adapter-loop@0.3.10
  - @partylayer/adapter-nightly@0.2.12
  - @partylayer/adapter-send@1.1.2
  - @partylayer/provider@0.2.3

## 0.7.0

### Minor Changes

- 27e5b68: A2: SDK-level announce discovery. `listWallets()` now aggregates
  `canton:announceProvider` wallets (EIP-6963-style, provider.md) with the
  `window.canton` namespace scan, the registry, and registered adapters:
  - a known announced id (matching a wallet's `providerDetection` provider.id)
    maps to that adapter — no duplicate picker entry (identity bridge);
  - an UNKNOWN announced id is surfaced as a dynamic `browser:ext:<id>` entry
    routed to its own extension `target` via the new `GenericAnnounceAdapter`, so
    future announce-capable Canton wallets appear and route with zero code changes.

  Gated by `discovery: { announce?: boolean }` (default ON in the browser, always
  skipped under SSR); one-shot cached with a `client.refreshDiscovery()` hook. With
  zero announcers, `listWallets()` output is unchanged. New exports:
  `GenericAnnounceAdapter`, `announcedWalletId`, `ANNOUNCED_WALLET_ID_PREFIX`.

### Patch Changes

- 76972de: A2.1: `listWallets()` aggregation now drops injected discovery entries whose
  identity is UNRESOLVED (`identityResolved === false`) instead of synthesizing a
  dynamic `browser:ext:<path-id>` entry. This removes the phantom "Canton Wallet"
  (`browser:ext:canton`) that appeared when Console's bare `window.canton` slot
  exposed no id and its `status()` probe didn't resolve one — the entry's provider
  was the slot itself, so clicking it opened Console. The slot's real wallet is
  represented by its resolved announce entry (bridged to its adapter) instead.
  Correctness is independent of probe timing.
- Updated dependencies [27e5b68]
- Updated dependencies [27e5b68]
- Updated dependencies [76972de]
  - @partylayer/provider@0.2.2
  - @partylayer/adapter-send@1.1.1

## 0.6.0

### Minor Changes

- 2c4c10c: feat(sdk): network-mismatch detection + enforcement (networkEnforcement, default 'guard') + session:networkMismatch event

  Detects when a connected wallet's effective network differs from the dApp's
  configured network, flags the session (`session.networkMismatch`), and emits
  `session:networkMismatch`. New `networkEnforcement?: 'off' | 'guard' | 'strict'`
  config (default `'guard'`): 'strict' also blocks connect; 'guard' blocks
  wrong-network transactions; 'off' detects + emits only.

  BEHAVIOR: transactions are now blocked on a detected wallet/dApp network
  mismatch by default; set `networkEnforcement: 'off'` to restore the previous
  always-proceed behavior. The session's `network` now reflects the wallet's
  reported network (adapters that read the live wallet); echo-only adapters still
  report the configured network, so there is no false positive.

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
- Updated dependencies [2c4c10c]
- Updated dependencies [9642aee]
- Updated dependencies [32c6c1c]
  - @partylayer/core@0.5.0
  - @partylayer/adapter-loop@0.3.9
  - @partylayer/provider@0.2.1
  - @partylayer/adapter-send@1.1.0
  - @partylayer/adapter-bron@0.2.12
  - @partylayer/adapter-cantor8@0.2.12
  - @partylayer/adapter-console@0.3.6
  - @partylayer/adapter-nightly@0.2.11
  - @partylayer/registry-client@0.3.3

## 0.5.0

### Minor Changes

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

- 8532f3d: Fix: replace runtime `require()` of workspace packages with proper ESM imports
  so browser/ESM consumers don't crash.

  `PartyLayerClient.asProvider()` did a runtime
  `require('@partylayer/provider')`. In the ESM build that hits esbuild's
  `__require` shim and throws **"Dynamic require of \"@partylayer/provider\" is
  not supported"** in browser bundles (Next dev **and** production), crashing
  `PartyLayerKit` on mount (`asProvider()` is called from the React provider).
  It now uses a top-of-file static `import { createProviderBridge } from
'@partylayer/provider'` — `asProvider()` stays synchronous with the same
  `CIP0103Provider` return type, and there is no dependency cycle
  (`@partylayer/provider` does not import `@partylayer/sdk`).

  `@partylayer/conformance-runner` (an ESM `type: module` CLI) used the `require`
  global (`require.resolve(...)` and a `require(adapterPath)` CJS fallback) in its
  adapter loader, which is undefined at runtime in ESM. It now derives a real Node
  require via `createRequire(import.meta.url)`.

- Updated dependencies [42c862d]
- Updated dependencies [6103d32]
- Updated dependencies [c18a275]
- Updated dependencies [53b1714]
  - @partylayer/provider@0.2.0
  - @partylayer/adapter-send@1.0.4
  - @partylayer/core@0.4.0
  - @partylayer/adapter-bron@0.2.11
  - @partylayer/adapter-cantor8@0.2.11
  - @partylayer/adapter-console@0.3.5
  - @partylayer/adapter-loop@0.3.8
  - @partylayer/adapter-nightly@0.2.10
  - @partylayer/registry-client@0.3.2

## 0.4.1

### Patch Changes

- Repair the transitive `@partylayer/core` dependency reference.

  `0.4.0` itself does not directly import any new core symbols, but it
  depends on `@partylayer/registry-client@^0.3.0`, whose `0.3.0` release was
  broken in the same way. Republishing the SDK ensures its workspace
  dependency resolution points to the fixed `registry-client@0.3.1` and the
  fixed `core@0.3.0`.

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @partylayer/adapter-send@1.0.1
  - @partylayer/registry-client@0.3.1
  - @partylayer/core@0.3.0
  - @partylayer/adapter-bron@0.2.10
  - @partylayer/adapter-cantor8@0.2.10
  - @partylayer/adapter-console@0.3.4
  - @partylayer/adapter-loop@0.3.7
  - @partylayer/adapter-nightly@0.2.9
  - @partylayer/provider@0.1.7

## 0.4.0

### Minor Changes

- 7770870: Registry-driven detection and adapter-aware picker readiness.

  `@partylayer/core` and `@partylayer/registry-client` introduce a multi-signal `providerDetection` schema on `RegistryWalletEntry`. Registry entries can declare a transport plus an ordered list of matcher rules (`domain`, `exact`, `prefix`) over the live CIP-0103 `status` shape — `kernel.url`, `kernel.userUrl`, `kernel.id`. This lets new CIP-0103 wallets be added to the ecosystem through a registry JSON update without an SDK code change, and lets the SDK identify a wallet by stable signals (vendor domain) when the per-install identity field (`kernel.id`) varies. The matcher engine is OR-combined, case-insensitive on domains, case-sensitive on exact values, and short-circuits on first match. 33 unit tests cover the matcher semantics.

  The registry-client schema also gains an optional `RegistryWalletEntry.beta?: boolean` flag and a `RegistryWalletEntry.cip0103?: { native, evidence, since }` marker. The picker UI uses `cip0103.native` to surface CIP-0103-native wallets in a dedicated section regardless of install state. The optional `beta` flag, when present on any entry, propagates through `WalletInfo.metadata.beta = 'true'` so UIs can render a "Beta" badge generically.

  `@partylayer/sdk` re-exports the detection helpers (`isCip0103Native`, `Cip0103Support`, `ProviderDetection`, `matchesProviderDetection`) and adds `getAdapter(walletId)` for adapter-aware UI integrations that need to probe `detectInstalled()` directly. The `tsup` external list grew to externalise all built-in adapter packages — the bundled SDK dist drops from ~80 KB ESM to ~30 KB ESM with no public API change.

  `@partylayer/react` renders the optional Beta badge in the wallet picker modal from `WalletInfo.metadata.beta`. The picker also adds an adapter-aware NATIVE readiness probe: when an adapter implements `detectInstalled()`, the picker reflects its result rather than guessing from a static install hint.

### Patch Changes

- Updated dependencies [7770870]
  - @partylayer/registry-client@0.3.0

## 0.2.8

### Patch Changes

- fix: resolve workspace:\* protocol in published packages and add ledgerApi support
- Updated dependencies
  - @partylayer/core@0.2.6
  - @partylayer/provider@0.1.3
  - @partylayer/registry-client@0.2.6
  - @partylayer/adapter-console@0.2.5
  - @partylayer/adapter-loop@0.2.5
  - @partylayer/adapter-cantor8@0.2.5
  - @partylayer/adapter-nightly@0.2.5
  - @partylayer/adapter-bron@0.2.5

## 0.2.6

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/core@0.2.4
  - @partylayer/provider@0.1.1
  - @partylayer/registry-client@0.2.4
  - @partylayer/adapter-console@0.2.4
  - @partylayer/adapter-loop@0.2.4
  - @partylayer/adapter-bron@0.2.4
  - @partylayer/adapter-cantor8@0.2.4
  - @partylayer/adapter-nightly@0.2.4

## 0.2.4

### Patch Changes

- fix: correct DEFAULT_REGISTRY_URL to base URL

  The DEFAULT_REGISTRY_URL was incorrectly set to include the full path `/v1/wallets.json`,
  which caused the RegistryClient to construct an invalid URL by appending `/v1/{channel}/registry.json` to it.

  Before: `https://registry.cantonconnect.xyz/v1/wallets.json/v1/stable/registry.json` (404)
  After: `https://registry.cantonconnect.xyz/v1/stable/registry.json` (correct)

## 0.2.3

### Patch Changes

- Update registry URL to cantonconnect.xyz domain

## 0.2.2

### Patch Changes

- Update GitHub repository URLs to cayvox/CantonConnect
- Updated dependencies
  - @partylayer/core@0.2.2
  - @partylayer/registry-client@0.2.2
  - @partylayer/adapter-console@0.2.2
  - @partylayer/adapter-loop@0.2.2
  - @partylayer/adapter-cantor8@0.2.2
  - @partylayer/adapter-bron@0.2.2

## 0.2.1

### Patch Changes

- Add comprehensive README documentation for npm package pages
- Updated dependencies
  - @partylayer/core@0.2.1
  - @partylayer/adapter-bron@0.2.1
  - @partylayer/adapter-cantor8@0.2.1
  - @partylayer/adapter-console@0.2.1
  - @partylayer/adapter-loop@0.2.1
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
  - @partylayer/core@0.2.0
  - @partylayer/registry-client@0.2.0
  - @partylayer/adapter-console@0.2.0
  - @partylayer/adapter-loop@0.2.0
  - @partylayer/adapter-cantor8@0.2.0
  - @partylayer/adapter-bron@0.2.0
