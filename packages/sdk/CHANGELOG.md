# @cantonconnect/sdk

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
  - @cantonconnect/core@0.2.2
  - @cantonconnect/registry-client@0.2.2
  - @cantonconnect/adapter-console@0.2.2
  - @cantonconnect/adapter-loop@0.2.2
  - @cantonconnect/adapter-cantor8@0.2.2
  - @cantonconnect/adapter-bron@0.2.2

## 0.2.1

### Patch Changes

- Add comprehensive README documentation for npm package pages
- Updated dependencies
  - @cantonconnect/core@0.2.1
  - @cantonconnect/adapter-bron@0.2.1
  - @cantonconnect/adapter-cantor8@0.2.1
  - @cantonconnect/adapter-console@0.2.1
  - @cantonconnect/adapter-loop@0.2.1
  - @cantonconnect/registry-client@0.2.1

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
  - @cantonconnect/core@0.2.0
  - @cantonconnect/registry-client@0.2.0
  - @cantonconnect/adapter-console@0.2.0
  - @cantonconnect/adapter-loop@0.2.0
  - @cantonconnect/adapter-cantor8@0.2.0
  - @cantonconnect/adapter-bron@0.2.0
