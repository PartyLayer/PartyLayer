# @partylayer/registry-client

## 0.5.2

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.5.1

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.5.0

### Minor Changes

- 3285ed8: Add the optional, additive `adapter.networkHosts` field (`NetworkHosts`) to registry wallet entries. For `transport: 'discovery-adapter'` wallets it maps each supported network to the wallet's host (e.g. `{devnet, testnet, mainnet}`); the generic SDK bridge resolves `networkHosts[activeNetwork]` at connect time so no wallet URL is hardcoded. `validateWalletEntry` now asserts the map shape when present (object of non-empty string hosts). Absent ⇒ unchanged behavior.

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.4.0

### Minor Changes

- 6efe375: Add the optional, additive `adapter.transport` field to registry wallet entries (`AdapterTransport`). Absent ⇒ unchanged behavior. `'discovery-adapter'` routes an entry through the SDK's generic official-adapter bridge (matched to an app-supplied `OfficialProviderAdapter` by `adapter.config.providerId`). `validateWalletEntry` now asserts the transport enum when present.
- adaff8e: Decouple the `events` capability from `transactionStatus`. Registry entries now declare an explicit, optional `capabilities.events` flag (emits CIP-0103 provider events); `registryEntryToWalletInfo` derives the `events` capability from THAT, not from `transactionStatus` (which only means the wallet can report tx status). A wallet that can await a tx commit but never emits events (e.g. a popup/remote wallet) no longer falsely advertises `events`. Additive + back-compat: entries without the flag simply don't get the `events` capability.

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.3.3

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.3.2

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.3.1

### Patch Changes

- Repair the `@partylayer/core` dependency reference.

  `0.3.0` was published declaring `@partylayer/core@^0.2.7`, but its compiled
  bundle imports nine symbols from core (the CIP-0103 detection helpers and
  related types) that only exist in `@partylayer/core@0.3.0+`. This release
  pins the dependency to the correct core range.

- Updated dependencies
  - @partylayer/core@0.3.0

## 0.3.0

### Minor Changes

- 7770870: Registry-driven detection and adapter-aware picker readiness.

  `@partylayer/core` and `@partylayer/registry-client` introduce a multi-signal `providerDetection` schema on `RegistryWalletEntry`. Registry entries can declare a transport plus an ordered list of matcher rules (`domain`, `exact`, `prefix`) over the live CIP-0103 `status` shape — `kernel.url`, `kernel.userUrl`, `kernel.id`. This lets new CIP-0103 wallets be added to the ecosystem through a registry JSON update without an SDK code change, and lets the SDK identify a wallet by stable signals (vendor domain) when the per-install identity field (`kernel.id`) varies. The matcher engine is OR-combined, case-insensitive on domains, case-sensitive on exact values, and short-circuits on first match. 33 unit tests cover the matcher semantics.

  The registry-client schema also gains an optional `RegistryWalletEntry.beta?: boolean` flag and a `RegistryWalletEntry.cip0103?: { native, evidence, since }` marker. The picker UI uses `cip0103.native` to surface CIP-0103-native wallets in a dedicated section regardless of install state. The optional `beta` flag, when present on any entry, propagates through `WalletInfo.metadata.beta = 'true'` so UIs can render a "Beta" badge generically.

  `@partylayer/sdk` re-exports the detection helpers (`isCip0103Native`, `Cip0103Support`, `ProviderDetection`, `matchesProviderDetection`) and adds `getAdapter(walletId)` for adapter-aware UI integrations that need to probe `detectInstalled()` directly. The `tsup` external list grew to externalise all built-in adapter packages — the bundled SDK dist drops from ~80 KB ESM to ~30 KB ESM with no public API change.

  `@partylayer/react` renders the optional Beta badge in the wallet picker modal from `WalletInfo.metadata.beta`. The picker also adds an adapter-aware NATIVE readiness probe: when an adapter implements `detectInstalled()`, the picker reflects its result rather than guessing from a static install hint.

## 0.2.6

### Patch Changes

- fix: resolve workspace:\* protocol in published packages and add ledgerApi support
- Updated dependencies
  - @partylayer/core@0.2.6

## 0.2.4

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/core@0.2.4

## 0.2.2

### Patch Changes

- Update GitHub repository URLs to cayvox/CantonConnect
- Updated dependencies
  - @partylayer/core@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.1

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
