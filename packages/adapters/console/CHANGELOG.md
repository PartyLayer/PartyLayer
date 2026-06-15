# @partylayer/adapter-console

## 0.3.11

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.3.10

### Patch Changes

- 46ccf16: Fix an SSR crash: lazy-load the Console Wallet SDK so importing `@partylayer/adapter-console` on the server no longer eagerly initializes the SDK's localforage storage (which throws "No available storage method found" with no IndexedDB/localStorage).

  The static value import of `@console-wallet/dapp-sdk` is replaced by a promise-cached dynamic import (`getConsoleWallet()`) that loads the SDK once, lazily, on first browser use. **Behavior-preserving — no public API change:** `on()` keeps its synchronous `(): () => void` signature (the subscription registers one microtask later via the cached import; events arrive via async postMessage, so none are missed). Fixes the localforage error logged by any SSR consumer (Next.js App Router, the demo).

## 0.3.9

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.3.8

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.3.7

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.3.6

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.3.5

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.3.4

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
