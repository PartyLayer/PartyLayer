# @cantonconnect/core

## 0.3.1

### Patch Changes

- Generalize `readField` in detection logic to read any top-level object on the status response, not just `kernel.*`. This is backward-compatible — existing `kernel.*` matchers continue to behave identically; this only enables matchers to also target `provider.*` and other future field paths in wallet status responses. Backward compatibility is enforced by a new parity test suite covering every status shape existing adapters can encounter.

## 0.3.0

### Minor Changes

- Promote CIP-0103 wallet-detection utilities to the public API surface.

  The following symbols were already imported by `@partylayer/registry-client`
  and `@partylayer/adapter-send` internally, but were not declared as exports
  in any published version of `@partylayer/core`:
  - `matchesProviderDetection`, `isCip0103Native`
  - `findMatchingWallet`, `findMatchingWalletInfo`, `deriveGenericWalletName`
  - type-only: `ProviderDetection`, `ProviderMatcher`, `Cip0103Support`,
    `Cip0103StatusForDetection`

  This release makes them part of the stable public API. No exports removed;
  fully backward-compatible with 0.2.x.

## 0.2.6

### Patch Changes

- fix: resolve workspace:\* protocol in published packages and add ledgerApi support

## 0.2.4

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.

## 0.2.2

### Patch Changes

- Update GitHub repository URLs to cayvox/CantonConnect

## 0.2.1

### Patch Changes

- Add comprehensive README documentation for npm package pages

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
