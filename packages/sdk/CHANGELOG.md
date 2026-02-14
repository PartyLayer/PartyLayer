# @cantonconnect/sdk

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
