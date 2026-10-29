# @partylayer/adapter-cantor8

## 0.5.1

### Patch Changes

- c130fc4: Correct SDK README examples to include the required application configuration. Show Send's Mainnet kit integration and explicit compatibility setup without duplicate registration, and document Bron's application-owned OAuth/API requirements. These complete examples now compile against the public package declarations in the documentation gate.

## 0.5.0

### Minor Changes

- Keep command ids for correlation without presenting them as ledger transaction hashes. A submission acknowledgement alone is not ledger confirmation.

- 0ebd598: Stop reporting wallets as installed when nothing was installed.

  `detectInstalled()` could only answer yes or no, and eight of twelve adapters had
  no honest way to answer it — a QR wallet, a hosted popup, a relay and an OAuth
  service have no local artefact to probe. They answered `true`, meaning
  "reachable", and the picker read it as "installed". Cantor8 is not an extension
  at all: its tile said installed, and clicking it opened a tab.

  `AdapterDetectResult` gains `availability`, which says what presence actually is:
  `installed`, `not-installed` (probed and absent, with an install URL),
  `no-local-install` (QR / popup / relay — nothing to probe), or `unknown` (the
  probe failed or timed out, which is not proof of absence). `installed` is
  deprecated in its JSDoc, still populated, and exactly
  `availability.kind === 'installed'`, so no consumer breaks.

  **The false `true` was load-bearing.** `installGuard` read `installed` and threw
  `WalletNotInstalledError` on false — so returning the truth would have blocked
  connect for every wallet that has nothing to install. Making the adapters honest
  broke connect for all of them until the guard was changed to ask its real
  question: not "is it installed" but "do we already know this cannot work", which
  only `not-installed` answers yes to. That coupling is why this is one contract
  change rather than eight independent bug fixes.

  Vendor `detect()` is no longer called for `discovery-adapter` wallets. All three
  implementations are constants (`walley`: `window.open` exists; `cauri`:
  `Promise.resolve(true)`; `oneswap`: `typeof window !== 'undefined'`), so awaiting
  them bought no information while adding an async hop to the picker's render path
  and a dependency on three third parties answering honestly. A `discovery-adapter`
  transport IS the answer; the rule is applied in exactly one place.

  The picker's subtitles for the two wallets measured causing real harm now say
  what a click will do: "Scan to connect — nothing to install" and "Opens in a
  popup — nothing to install".

  `docs/adapters.md` records which adapters probe what, and one mismatch still
  outstanding: Cantor8 classifies as `scan` but opens a tab, a registry-data fix
  queued with the D5/D6 registry work.

### Patch Changes

- Updated dependencies [817d357]
- Updated dependencies [2e07185]
- Updated dependencies [882752f]
- Updated dependencies [0ebd598]
- Updated dependencies [8cb0f09]
- Updated dependencies [8e08da9]
  - @partylayer/core@0.15.0

## 0.4.2

### Patch Changes

- Updated dependencies [9e8ca31]
- Updated dependencies [fbda51f]
  - @partylayer/core@0.14.0

## 0.4.1

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.4.0

### Minor Changes

- 2646186: Fix Cantor8 availability: a hosted popup is always reachable, so detect reports available instead of waiting for an in-page announcement that never comes.

  Cantor8 is a hosted popup wallet (it opens wallet.dev.digik.cantor8.tech through its SDK), so nothing runs in the dApp page to announce over the SDK's `c8#provider_discovery` event. The previous `detectInstalled` subscribed to that event and waited, so it always timed out and reported the wallet permanently unavailable, which hid Cantor8 from the picker. Detection now follows the same gateway contract the official ProviderAdapter path uses (the one Walley connects through): a hosted popup is reachable wherever it can be opened, so detect reports available and the real availability check happens at connect, when the popup opens.

  The `detectTimeoutMs` config option is removed, since detection no longer waits.

  Note: this is implemented against Cantor8's published SDK (`@cantor8/wallet-connect-sdk`), not yet verified against their live product; a full end to end run still needs the real Cantor8 wallet.

## 0.3.0

### Minor Changes

- 703a645: Rebuild the Cantor8 adapter on the wallet's own SDK, `@cantor8/wallet-connect-sdk` (0.4.0). The previous adapter (published at 0.2.20) was a non-functional `cantor8://` deep-link stub that threw "Cantor8 vendor not configured" on connect. It now drives the real popup + postMessage protocol: `connect` reads the party from `getAccounts()`, `submitTransaction` maps to `signAndExecute`, `disconnect` and transaction-status events (`txChanged`, surfaced via `on('txStatus')`) map to real SDK methods, and `detectInstalled` uses the wallet's own `c8#provider_discovery` event instead of a user-agent sniff that mislabeled this desktop popup wallet as mobile. The SDK supports devnet and mainnet only.

  Cantor8 has no arbitrary-message signing, so `signMessage` now fails with `CapabilityNotSupportedError` rather than the stub's fabricated deep-link signature. It is not simulated, not routed through a transaction method, and does not silently succeed.

  BREAKING for `@partylayer/adapter-cantor8`:
  - Removed the `Cantor8VendorConfig` and `Cantor8VendorModule` types (the deep-link vendor abstraction).
  - `Cantor8AdapterConfig` no longer has `vendorModule`, `vendorConfig`, or `useMockTransport`; it now has `dappUrl?` and `detectTimeoutMs?`.
  - Removed `signTransaction` and `restore`; added `submitTransaction`, `on`, and the `Cantor8SubmitPayload` type.
  - `signMessage` now rejects instead of returning a value.

  A consumer upgrading who imported the removed vendor/deep-link types or called `signTransaction` will get a compile error; anyone who called `signMessage` will now get a clear capability error instead of a fake success. This is intended: the wallet has no message signing, and the previous stub could not connect at all.

  The mapping and discovery are unit-tested against a mock of the SDK; a live connect/submit run requires the actual Cantor8 wallet. This change adds a runtime dependency on `@cantor8/wallet-connect-sdk` (zero-dependency, MIT), lazily imported to stay SSR-safe.

## 0.2.20

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.2.19

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.2.18

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.2.17

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

## 0.2.16

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.2.15

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.2.14

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.2.13

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.2.12

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.2.11

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.2.10

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.3.0

## 0.2.5

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
