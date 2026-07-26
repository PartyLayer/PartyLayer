# @partylayer/react-native

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
