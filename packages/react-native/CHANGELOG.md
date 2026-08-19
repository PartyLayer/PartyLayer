# @partylayer/react-native

## 1.0.0

### Major Changes

- 9015d18: Add the provider pattern, session and transaction hooks, a theme provider, and a complete connect modal.

  New: `PartyLayerProvider` holds the client, the sdk session, the wallet list and the shared session store. `useAccount`, `useSession` and `useAccountEffect` read that store; they require the provider. `useDisconnect`, `useSignMessage`, `useSignTransaction`, `useSubmitTransaction` and `useLedgerApi` take the client from the provider or from an explicit argument. `ThemeProvider` and `useTheme` supply a theme to components; `useTheme` falls back to the default light theme rather than throwing when there is no provider. `ConnectModal` runs the whole connect flow and takes no props but its visibility when the providers are present.

  The transaction hooks add no capability checking of their own: the sdk client guards each method and throws `CapabilityNotSupportedError`, which passes through unchanged, so a wallet that does not advertise a capability produces the same typed error the web path produces.

  `ConnectModal` drops its slide animation when the OS reduce motion setting is on, marks the sheet as a modal for screen readers with a polite live region for state changes, and takes an optional `insets` prop for safe areas. `WalletList` delegates to it, so existing callers get the same behavior.

  Documented and made fixable: on React Native the shared session store falls back to in-memory storage, because the default needs IndexedDB, so a session does not survive an app restart. Passing `asyncStorage` to `PartyLayerProvider` persists it.

  No new runtime or peer dependency.

  Not a breaking change for a 0.2.2 consumer despite the major: every 0.2.2 export is still exported with the same behavior, `useConnect(client)` and `useWallets(client, parameters)` still work with no provider, and the `client` and `theme` props on the components are now optional rather than removed. The major reflects the size of the new surface, not a removal. Two behavior notes: the connecting state now reads "Waiting for the wallet to respond..." instead of claiming the wallet app is being opened, and a hook given a new client identity resets its state, so a client constructed inside a component body should move to module scope or a `useMemo`.

### Patch Changes

- 63dcd1e: Correct the package's description of itself. The npm description and the shipped entry headers said "phase A, no UI" while the `./ui` entrypoint ships ConnectButton, WalletList, WalletIcon and the chrome icons, and internal "this PR" language had leaked into the published README and the ui entry header. The `deeplink` keyword is gone: `createReactNativeDeepLinkPlatform` is a `DeepLinkPlatform` building block for authors writing their own `WalletAdapter` around core's `DeepLinkTransport`, and the README now documents it that way with an example, rather than the client factory implying it installs a deep link transport. The README also shows the required AsyncStorage argument on the `.` entrypoint, where it previously showed it as optional, and documents the `./async-storage` subpath that provides the no-argument forms. The storage precedence JSDoc now matches the code: an explicit `storage` wins over `asyncStorage`. Documentation and metadata only; no runtime behavior changes.
- Updated dependencies [d25d850]
- Updated dependencies [4309023]
  - @partylayer/sdk@0.18.2
  - @partylayer/core@0.13.0
  - @partylayer/session@1.1.7

## 0.2.2

### Patch Changes

- Updated dependencies [4fb8c0f]
  - @partylayer/sdk@0.18.0

## 0.2.1

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Wallet icons whose SVG URL returns non-SVG content now fall back to the neutral wallet glyph instead of rendering nothing. The renderer fetches the SVG, checks the body is real SVG markup, and draws it with react-native-svg's `SvgXml`. Previously it used `SvgUri`, which fetches internally but does not report an error when the response is not SVG (for example a registry or CDN URL that returns an HTML landing page), so a bad URL rendered blank with no fallback. A failed fetch also falls back to the glyph.
- Updated dependencies
- Updated dependencies
  - @partylayer/sdk@0.17.0
  - @partylayer/core@0.12.1
  - @partylayer/session@1.1.6

## 0.2.0

### Minor Changes

- 482ec3e: Add the React Native compatibility layer (phase A), a headless package built on the
  framework-agnostic core.

  Core: the deep link transport's two platform primitives, opening a URL and subscribing
  to inbound callbacks, are now supplied through a DeepLinkPlatform rather than assumed.
  The browser platform is the default, so existing consumers behave exactly as before,
  and DeepLinkTransport accepts an optional platform in its constructor. New exports:
  DeepLinkPlatform, DeepLinkCallback, createBrowserDeepLinkPlatform. Nothing is removed
  or renamed.

  New package @partylayer/react-native: a React Native DeepLinkPlatform built on the
  Linking API, an AsyncStorage backed SessionStorage, and a headless client factory that
  wires the sdk with device session persistence. No UI components in this phase; those and
  an Expo demo follow later. Tested with the React Native modules mocked, since CI has no
  React Native runtime.

- 9ec61b6: Add the React Native connect UI (phase B2), behind a new "./ui" subpath so the headless
  "." entrypoint stays free of the SVG renderer.

  Components: ConnectButton (a Pressable reflecting the connect state, using the theme
  pressed color), WalletList (the connect modal over a FlatList with the core flow states:
  list, connecting and cancellable, error with retry, and dismiss on connect), WalletIcon,
  and the core chrome icons (close, back, error, spinner). Wallet logos are always real,
  never letters: PNG and JPG through Image, SVG through react-native-svg's SvgUri, and a
  neutral glyph fallback for an unknown format or a load failure.

  react-native-svg is declared as an OPTIONAL peer dependency, required in practice only
  for the ui entrypoint; the headless entrypoint never imports it, and the ui entrypoint
  throws a clear error when it is missing. On mobile the deep link transport opens the
  wallet app directly, so there is no QR screen to port from the web modal.

  Also ports the seven accent presets and the accent override capability into the RN theme
  (applyAccent, accentPresets), matching the web theme, and adds a drift test that fails
  when the copied theme data diverges from packages/react/src/theme.tsx.

- 488a9ea: Load the optional peers through static imports so a bundler can see them. The loaders
  previously read `require` through a variable, which Metro (on native and web) cannot
  resolve at build time, so the module was never bundled and the loader threw its "not
  installed" error at runtime even when the peer WAS installed. Opening the connect UI on
  web crashed for exactly this reason; the deep link and storage loaders carried the same
  latent pattern.
  - The `./ui` entrypoint statically imports react-native-svg. A consumer of `./ui` without
    it now gets a bundler resolution error at build time rather than a runtime crash. The
    headless "." entrypoint still never imports it.
  - `createReactNativeDeepLinkPlatform()` now defaults to a static `import { Linking } from
'react-native'`, so the no-argument call resolves. The optional parameter remains for
    injection and testing.
  - AsyncStorage is genuinely optional: the base `createAsyncStorage` and
    `createAsyncStorageAdapter` now REQUIRE the module to be passed, and a new
    `@partylayer/react-native/async-storage` subpath provides no-argument factories that
    statically import it (mirroring `./ui`). The "." entrypoint therefore never forces the
    AsyncStorage peer.

  This is a breaking signature change to `createAsyncStorage`/`createAsyncStorageAdapter`
  (now unpublished), and adds the `./async-storage` subpath. A web smoke in the Expo demo
  (`pnpm run web-smoke`) now guards against a reversion, since the mocked unit tests cannot
  catch bundler-invisible loading.

- f6b40dc: Add the React Native theme bridge and headless hooks (phase B1). No visual components.

  Theme bridge: convert a PartyLayerTheme into a React Native ready object. Colors pass
  through verbatim (React Native accepts hex and rgba). Three fields are adapted:
  borderRadius is parsed from a CSS length into a number (px and rem with a 16px rem
  base, falling back to 10), overlayBlur is dropped in favor of an opaque overlay color
  derived from colors.overlay, and primaryHover is exposed as a pressed color for
  Pressable states. The six theme families are copied into the package as pure data,
  because the react theme module is only reachable through a DOM bound entrypoint.

  Headless hooks built on the phase A client: useWallets loads the registry list with
  loading, success, and error states and exposes per wallet icon data (URL plus a format
  hint of svg, png, jpg, or unknown), and useConnect connects, disconnects, tracks the
  current session, and surfaces status and errors. They consume the sdk and reuse its
  registry logic; the client is passed explicitly so the package stays headless.

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0
  - @partylayer/sdk@0.16.0
  - @partylayer/session@1.1.5
