# @partylayer/adapter-send

## 1.0.0

### Major Changes

- First stable release of the Send Canton Wallet adapter.

  The adapter ships as a CIP-0103 native adapter and exposes the Send wallet's `window.canton` provider through PartyLayer's standard `WalletAdapter` interface. Capabilities: `connect`, `disconnect`, `restore` (silent `status` probe — no popup on page reload), `signMessage` (passkey-signed via WebAuthn-PRF), `submitTransaction` (via `prepareExecuteAndWait`; receipt populated from `tx.payload.updateId`), `ledgerApi` (full Sigilry passthrough), `events` (`txChanged` bridged to PartyLayer's `tx:status` channel), and `injected` discovery on `window.canton`.

  `signTransaction` is intentionally not declared and throws `CapabilityNotSupportedError` pointing at `submitTransaction` — Send fuses sign-and-submit through `prepareExecuteAndWait`, so a standalone sign step would mislead callers.

  Detection runs through the registry's `providerDetection` rules so the adapter can be added to the ecosystem through a registry JSON update without an SDK code change. A built-in matcher mirror (`SEND_BUILTIN_DETECTION`) ships as a defensive fallback for adapter-only installs where the registry fetch has not yet completed. Parity between the registry rule and the built-in mirror is verified by a test in the adapter's vitest suite.

  Structured JSON-RPC errors are mapped onto the canonical PartyLayer error taxonomy (`UserRejectedError` for code 4001, `TransportError` for transport-level codes, `CapabilityNotSupportedError` for unsupported-method codes), so existing error-handling branches in dApp code continue to work without modification.

### Changed

- SEND_INSTALL_URL value changed from a direct extension store URL to https://sigilry.org. dApps surfacing the installUrl field to users will now route through the Send wallet's homepage rather than a direct extension installation page.
