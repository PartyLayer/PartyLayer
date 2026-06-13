# @partylayer/adapter-send

## 1.1.3

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0
  - @partylayer/provider@0.2.4

## 1.1.2

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0
  - @partylayer/provider@0.2.3

## 1.1.1

### Patch Changes

- 27e5b68: A2 incident fix: correct Send's extension-id data. Live diagnostics + Console
  Wallet's own extension source proved `lpnfhpbpmlobjlgkdmnjieeihjmihhjd` is
  **Console's** id, not Send's; it was wrongly held in `SEND_PRODUCTION_EXTENSION_ID`
  / `SEND_KNOWN_EXTENSION_IDS` / `SEND_BUILTIN_DETECTION`, so Console's announce
  matched Send's accepted ids → a Send click could bind Console's channel and open
  Console (the original swap). Send's id set is now its own id
  (`ldmohiccoioolenadmogclhoklmanpgi`) only. Exported symbol NAMES are unchanged;
  only the values are corrected (`SEND_LEGACY_EXTENSION_ID` is now a deprecated
  alias of the production id).
- Updated dependencies [27e5b68]
- Updated dependencies [76972de]
  - @partylayer/provider@0.2.2

## 1.1.0

### Minor Changes

- 32c6c1c: feat: report the wallet's effective network in session.network (enables network-mismatch detection)

  `connect()` now sets `session.network` to `status.network?.networkId ??
account.networkId ?? ctx.network` (prefer the wallet-reported network), so the
  SDK's `networkEnforcement` can detect a wallet/dApp network mismatch for Send.
  Unchanged when the wallet is on the configured network.

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
- Updated dependencies [9642aee]
  - @partylayer/core@0.5.0
  - @partylayer/provider@0.2.1

## 1.0.4

### Patch Changes

- 6103d32: Fix: Send is now found/connectable even when another wallet (Console) owns the
  shared `window.canton` slot.

  Send is announce-only — it advertises via `canton:announceProvider` and routes
  RPCs over the splice postMessage `target` channel; it does NOT inject
  `window.canton`. The previous transport bound `window.canton` and guarded by
  `kernel.id`, so when Console owned the slot, `detectInstalled()` reported
  "kernel.id does not match Send" and Send was unconnectable.

  `SendProvider` now:
  - detects Send via `discoverAnnouncedProviders` from `@partylayer/provider`
    (matching the announce id against the registry `ProviderDetection`
    `provider.id` matchers ∪ `SEND_KNOWN_EXTENSION_IDS`), and
  - routes every RPC through the announced `target` extension-channel provider.

  `detectInstalled()` is installed iff Send announces (independent of who owns
  `window.canton`); its reason text no longer references `window.canton`/`kernel.id`.
  The full public `SendProvider` surface is preserved (additive optional
  `SendProviderOptions` constructor argument). Adds `@partylayer/provider` as a
  dependency (both published). No other adapter is affected.

  Note: the splice extension (sync) transport has no inbound push-event channel,
  so `on('txChanged')` remains best-effort (tx results come from
  `prepareExecuteAndWait`'s response); `on`/`off` are preserved over the channel
  event bus.

- Updated dependencies [42c862d]
- Updated dependencies [c18a275]
- Updated dependencies [53b1714]
  - @partylayer/provider@0.2.0
  - @partylayer/core@0.4.0

## 1.0.3

### Patch Changes

- Republish 1.0.2 with the workspace protocol expanded to a concrete npm range. The 1.0.2 tarball was published with `vanilla npm publish`, which does not expand `workspace:^` literals — the resulting `package.json` on npm declared `"@partylayer/core": "workspace:^"`, causing dependency resolution to fail for external consumers. This release uses `pnpm publish` so the range expands correctly to `^0.3.1`.

  No source code changes — same detection logic as 1.0.2.

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
