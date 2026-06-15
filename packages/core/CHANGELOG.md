# @partylayer/core

## 0.9.0

### Minor Changes

- 5546a90: Add `AdapterNotRegisteredError` — an actionable, catchable error when connecting to a popup/remote (`transport: 'discovery-adapter'`) wallet whose app-supplied provider adapter was never registered.

  Previously `connect({ walletId: 'walley' })` for a known-but-unwired discovery wallet threw a bare `WalletNotFoundError` ("Wallet 'walley' not found"), conflating a config gap with a missing wallet. Now the SDK throws `AdapterNotRegisteredError` (code `ADAPTER_NOT_REGISTERED`) with a generic, registry-derived message that tells you how to wire it: `adapters: [{ providerId, create }]`. Distinct from `WalletNotFoundError` so higher-level UIs (e.g. PartyLayerKit) can catch it specifically. Scoped strictly to `discovery-adapter` entries; truly-unknown wallets still throw `WalletNotFoundError`. Maps to JSON-RPC `INVALID_PARAMS` on the provider surface.

## 0.8.0

### Minor Changes

- bef0ac6: `detectNetworkMismatch` no longer fails open on unrecognized networks. Previously it returned `null` (no mismatch) whenever either side was not a well-known Canton CAIP-2 id — so a wallet reporting an unknown network (e.g. `canton:unknown`, as popup/remote wallets like Walley do) could silently restore/transact against a DIFFERENT configured network.

  New rule: normalize both (short→CAIP-2 where possible) then compare — EQUAL ⇒ no mismatch (including two equal unrecognized values, protecting a legitimate same-network restore), UNEQUAL ⇒ mismatch (including a recognized network vs an unrecognized-but-different one). Unparseable inputs fall back to a raw equality comparison, so an exotic-but-different network can never slip through. This is the generic safety half of the restore network-gate fix.

  Also adds `isRecognizedNetwork(networkId)` — whether a value normalizes to a well-known Canton network (mainnet/testnet/devnet/local); `canton:unknown`, other namespaces, and unparseable values return false. Used by the SDK bridge to decide whether to trust a wallet-reported network.

## 0.7.0

### Minor Changes

- 3285ed8: Add `OfficialAdapterFactory` (+ `isOfficialAdapterFactory` guard) and the `NetworkHosts` type for generic, network-driven host resolution of discovery-adapter wallets.

  An official ProviderAdapter (e.g. Walley) seals its `host` at construction (`private host`, no setter), so a pre-built instance cannot be re-pointed at another network's host. `OfficialAdapterFactory` is the `create(host)` form the generic bridge uses to construct the official adapter with a host resolved from registry data at connect time — so an app writes `<PartyLayerKit network="mainnet">` and never hardcodes a URL. `NetworkHosts` (`Partial<Record<NetworkId, string>>`) is the network→host mapping that lives as DATA in a wallet's registry entry. Both additive; the pre-constructed `OfficialProviderAdapter` instance form is unchanged.

## 0.6.0

### Minor Changes

- 6efe375: Add the `OfficialProviderAdapter` duck-type + `isOfficialProviderAdapter` guard and the `AdapterTransport` registry vocabulary.

  These let the generic SDK layer host an app-supplied official `@canton-network/core-wallet-discovery` `ProviderAdapter` (e.g. a popup/remote wallet like Walley) by structural shape — we never import `@canton-network/*` and there is no wallet-specific adapter package. `AdapterTransport` (`'injected' | 'announce' | 'discovery-adapter'`) is the additive registry marker for how a wallet's provider is obtained.

- adaff8e: Add the `OfficialProvider` interface and loosen `OfficialProviderAdapter.provider()`/`restore()` to return it (was `CIP0103Provider`). The official `@canton-network` `Provider<RpcTypes>` types `request` as generic over its own method literals, which is not structurally assignable to the string-method `CIP0103Provider.request` — so the stricter type prevented passing a real official adapter (e.g. `new WalleyAdapter()`) without a cast. `OfficialProvider` is loose enough that a real official adapter satisfies it; the bridge treats it as a `CIP0103Provider` at the call site (it only ever calls `request({ method, params })`).

## 0.5.0

### Minor Changes

- 9642aee: feat(core): add CAIP-2 network utilities (CANTON_NETWORKS, toCAIP2Network, fromCAIP2Network, isValidCAIP2)

  These moved from @partylayer/core's consumer (@partylayer/provider) into core so
  the lower adapter layer can derive a WalletConnect CAIP-2 chain from a
  PartyLayer NetworkId without an illegal upward import. Additive — provider
  re-exports them unchanged.

- 2c4c10c: feat(core): NetworkMismatchError + detectNetworkMismatch + Session.networkMismatch
  - `NetworkMismatchError` (code `NETWORK_MISMATCH`, public `expected`/`actual`).
  - `detectNetworkMismatch(expected, actual)` — conservative: returns the
    normalized `{expected, actual}` only for a confident, recognized,
    DIFFERENT-network mismatch; `null` otherwise (never a false positive).
  - Optional `Session.networkMismatch?: { expected; actual }` (additive).

## 0.4.0

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
