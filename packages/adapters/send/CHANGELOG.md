# @partylayer/adapter-send

## 1.0.2

### Patch Changes

- Add production Send Canton wallet extension ID (`lpnfhpbpmlobjlgkdmnjieeihjmihhjd`) and the `status.provider.id` matcher path to the built-in detection rules. The previous detection (kernel-based matchers + legacy Chrome Web Store listing ID) is retained as a defensive fallback. Fixes the "Send not found" error in dApp connect modals when the Send extension is installed.

  Adds `SEND_KNOWN_EXTENSION_IDS`, `SEND_PRODUCTION_EXTENSION_ID`, and `SEND_LEGACY_EXTENSION_ID` named exports. `SEND_KERNEL_ID` retained as a `@deprecated` alias for source-compat.

- Updated dependencies
  - @partylayer/core@0.3.1

## 1.0.1

### Patch Changes

- Repair the `@partylayer/core` dependency reference.

  `1.0.0` was published declaring `@partylayer/core@^0.2.7`, but its compiled
  bundle imports `matchesProviderDetection` and `ProviderDetection` — symbols
  that only exist in `@partylayer/core@0.3.0+`. External consumers of `1.0.0`
  saw build failures during bundler resolution (Vite/Rollup). This release
  pins the dependency to the correct core range.

- Updated dependencies
  - @partylayer/core@0.3.0

## 1.0.0

### Major Changes

- First stable release of the Send Canton Wallet adapter.

  The adapter ships as a CIP-0103 native adapter and exposes the Send wallet's `window.canton` provider through PartyLayer's standard `WalletAdapter` interface. Capabilities: `connect`, `disconnect`, `restore` (silent `status` probe — no popup on page reload), `signMessage` (passkey-signed via WebAuthn-PRF), `submitTransaction` (via `prepareExecuteAndWait`; receipt populated from `tx.payload.updateId`), `ledgerApi` (full Sigilry passthrough), `events` (`txChanged` bridged to PartyLayer's `tx:status` channel), and `injected` discovery on `window.canton`.

  `signTransaction` is intentionally not declared and throws `CapabilityNotSupportedError` pointing at `submitTransaction` — Send fuses sign-and-submit through `prepareExecuteAndWait`, so a standalone sign step would mislead callers.

  Detection runs through the registry's `providerDetection` rules so the adapter can be added to the ecosystem through a registry JSON update without an SDK code change. A built-in matcher mirror (`SEND_BUILTIN_DETECTION`) ships as a defensive fallback for adapter-only installs where the registry fetch has not yet completed. Parity between the registry rule and the built-in mirror is verified by a test in the adapter's vitest suite.

  Structured JSON-RPC errors are mapped onto the canonical PartyLayer error taxonomy (`UserRejectedError` for code 4001, `TransportError` for transport-level codes, `CapabilityNotSupportedError` for unsupported-method codes), so existing error-handling branches in dApp code continue to work without modification.

### Changed

- SEND_INSTALL_URL value changed from a direct extension store URL to https://sigilry.org. dApps surfacing the installUrl field to users will now route through the Send wallet's homepage rather than a direct extension installation page.
