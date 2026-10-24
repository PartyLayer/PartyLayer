# @partylayer/registry-client

## 0.7.0

### Minor Changes

- 2e07185: Give the registry a field for how a wallet connects, and four capabilities it could not express.

  One overloaded signal was answering three independent questions: how a wallet is
  DISCOVERED, how its SDK is LOADED, and how it CONNECTS. `installation.scriptTag`
  says how the SDK is loaded, and it was read as "scan" — which is right for Loop
  and wrong for Cantor8, script-loaded but opening a popup.

  `connect: ('injected' | 'popup' | 'relay')[]` is now its own field. The shapes
  came from surveying all ten wallets rather than from the one that prompted it,
  and that ordering paid: Loop and WalletConnect are BOTH `relay` — a QR scanned by
  a phone app and a mobile pairing — so a popup-versus-scan flag would have been
  wrong for two wallets on day one. Their shared subtitle reads "Connect from
  another device", because the axis is where the connection happens, not what the
  UI looks like.

  ORDER IS PREFERENCE ORDER, and it has a reader: `connect[0]` is what the picker
  tries first, and `preferInstalled: false` — the modal's "Try mobile" affordance —
  advances to the next entry. Console is `['injected', 'relay']`. That preference
  already exists; it is hardcoded in Console's adapter today, and this is where it
  belongs instead.

  `transfer`, `ledgerApi`, `popup` and `restore` are now expressible.
  `walletInfo.capabilities` could never contain them, so
  `listWallets({ requiredCapabilities: ['transfer'] })` matched zero wallets while
  every adapter implemented `requestTransfer` — two capability gates reading
  contradictory sources.

  Also fixed: `installHints.deepLinkScheme` was populated from
  `installation.scriptTag`, putting an npm package name in a field meaning
  `loop://`, while `installation.deeplink` was never mapped at all. Both halves
  corrected. Nothing read the field, so it was inert — wrong value, right value
  dropped, and it would have shipped broken the day something read it.

  No registry entries change here. The data follows once this is published, so no
  client sees entries declaring a schema it does not understand.

- 8e08da9: Stop reporting registry verification that did not happen.

  Four defects in the signature path, all currently inert because nothing
  configures `registryPublicKeys`, and all of which would have shipped broken on
  the day signing is enabled.

  **A 304 bypassed verification entirely.** On `304 Not Modified` the client
  returned the cached registry without checking anything, and when the signature
  fetch failed it fabricated `{ algorithm: 'ed25519', signature: '',
keyFingerprint: '' }` and returned it as though all was well. Once keys are
  configured most requests are 304s, so the unverified path would have been the
  common one rather than an edge case.

  A 304 now means only what it says: the served bytes are the ones our ETag names.
  That is enough to reuse a cache entry we already verified, and not enough to
  call an unverified entry verified. The client only offers `If-None-Match` when
  the entry it would revalidate is one it could legitimately reuse, so an
  unverified entry causes a full body to be fetched and checked.

  **`verified: true` was hardcoded.** Both the cache write and the status update
  set it unconditionally, so `RegistryStatus.verified` reported true even in dev
  mode where no key is configured and the signature is never requested. It is a
  public field the docs tell people to read. It now reflects what actually
  happened, including `false` in dev mode.

  **A missing signature was indistinguishable from an outage.** Both produced the
  fabricated empty signature above. They are now separate outcomes: a `404` or
  `410` raises the new `RegistrySignatureMissingError` (a deployment state:
  signing not published for this channel), while an unreachable or failing
  endpoint raises `RegistryFetchFailedError` (an outage). Either way, a client
  holding a previously verified entry keeps serving it rather than going dark, so
  the first CDN blip after enabling signing cannot take wallet discovery down.

  **A failed verification was silently swallowed.** The refresh error handler fell
  back to the last known good entry for every error, including
  `RegistryVerificationFailedError`. That is the one case signature checking
  exists to catch, and swallowing it left the app working and the operator
  uninformed, which is the same as not checking. It now propagates.

  The manifest and its signature are also fetched as a unit and verified against
  the bytes that call received, rather than fetched independently. The two were
  served with different `max-age` values, so a client could pair a fresh manifest
  with a stale signature and fail verification on a pair that is valid at the
  origin. The CDN header is corrected too, but fetching them together is what
  stops the class of bug returning if a header drifts again.

  `SignatureOutcome` is exported: a discriminated union whose verified variants
  are not constructible without having run the check, so no path can express
  success it did not earn.

### Patch Changes

- Updated dependencies [817d357]
- Updated dependencies [2e07185]
- Updated dependencies [882752f]
- Updated dependencies [0ebd598]
- Updated dependencies [8cb0f09]
- Updated dependencies [8e08da9]
  - @partylayer/core@0.15.0

## 0.6.4

### Patch Changes

- Updated dependencies [9e8ca31]
- Updated dependencies [fbda51f]
  - @partylayer/core@0.14.0

## 0.6.3

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.6.2

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.6.1

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.6.0

### Minor Changes

- Classify each wallet's connection transport from its registry entry so the wallet picker can show a clean label (for example Browser Extension, Mobile wallet, or Scan to connect) instead of raw method names.

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.5.3

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

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

  `@partylayer/core` and `@partylayer/registry-client` introduce a multi-signal `providerDetection` schema on `RegistryWalletEntry`. Registry entries can declare a transport plus an ordered list of matcher rules (`domain`, `exact`, `prefix`) over the live CIP-0103 `status` shape: `kernel.url`, `kernel.userUrl`, `kernel.id`. This lets new CIP-0103 wallets be added to the ecosystem through a registry JSON update without an SDK code change, and lets the SDK identify a wallet by stable signals (vendor domain) when the per-install identity field (`kernel.id`) varies. The matcher engine is OR-combined, case-insensitive on domains, case-sensitive on exact values, and short-circuits on first match. 33 unit tests cover the matcher semantics.

  The registry-client schema also gains an optional `RegistryWalletEntry.beta?: boolean` flag and a `RegistryWalletEntry.cip0103?: { native, evidence, since }` marker. The picker UI uses `cip0103.native` to surface CIP-0103-native wallets in a dedicated section regardless of install state. The optional `beta` flag, when present on any entry, propagates through `WalletInfo.metadata.beta = 'true'` so UIs can render a "Beta" badge generically.

  `@partylayer/sdk` re-exports the detection helpers (`isCip0103Native`, `Cip0103Support`, `ProviderDetection`, `matchesProviderDetection`) and adds `getAdapter(walletId)` for adapter-aware UI integrations that need to probe `detectInstalled()` directly. The `tsup` external list grew to externalise all built-in adapter packages. The bundled SDK dist drops from ~80 KB ESM to ~30 KB ESM with no public API change.

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
