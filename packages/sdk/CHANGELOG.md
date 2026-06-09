# @partylayer/sdk

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
