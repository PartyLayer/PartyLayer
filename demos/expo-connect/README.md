# PartyLayer Expo connect demo

Runs the actual `ConnectButton` and `WalletList` from `@partylayer/react-native` on a
device, a simulator, or the web target, against local builds of our packages.

It lives OUTSIDE the pnpm workspace (in `demos/`, which no workspace glob matches) with
its own lockfile, because Expo 57 pins React 19 and react-native 0.86 while the workspace
runs React 18. The two dependency universes must not mix.

## Scope

This demo shows the wallet list built from a live registry fetch, the connect flow UI
(the connecting state, the error state, and retry), the theme from the bridge, the
per-wallet icon rendering, and a client that persists its session with AsyncStorage
against the configured network. Completing an end to end connect additionally requires a
Canton wallet app that the selected adapter can reach. A connect that cannot complete
renders the error path; nothing here fakes a successful connect.

## Why local package builds (not npm)

The demo exists to exercise the packages BEFORE they are published, so it has to run the
working tree rather than whatever the registry serves. A local build and a published
release can carry the same version number, so a plain install would resolve the registry
copy. The demo packs local builds into `vendor/` and forces every `@partylayer` package
to those tarballs through pnpm `overrides`, which makes the working tree the thing under
test. `verify-core.mjs` confirms the vendored copies are what resolved, by reading the
resolved module path.

## Run it

Requirements: Node, pnpm, and one of an iOS simulator (Xcode), an Android emulator
(Android SDK), or the Expo Go app on a physical phone.

```bash
cd demos/expo-connect
pnpm run prepare-local     # build + pack the local PartyLayer tarballs into vendor/
pnpm install               # own lockfile; resolves the tarballs via overrides
pnpm run verify-core       # headless check that the vendored builds resolved (optional)

pnpm run web               # web target (react-native-web) in a browser
pnpm run ios               # iOS simulator (needs full Xcode)
pnpm run android           # Android emulator (needs the Android SDK)
pnpm start                 # then scan the QR with Expo Go on a phone
```

Installed standalone (it is physically inside the repo but not a workspace member):

```bash
pnpm install --ignore-workspace
```

## Three verification paths, and what each proves

- **Web (react-native-web), available now, no device.** Runs the SAME components in a
  browser. Covers component rendering, the theme from the bridge, the live registry
  fetch, and the flow logic. Here `Linking.openURL` maps to a browser navigation and
  AsyncStorage is backed by IndexedDB.
- **Expo Go on a phone**, needs only the Expo Go app. Covers the same flow on a real OS
  with the native module bindings and the native store, without a full toolchain.
- **Simulator or emulator**, needs Xcode or Android Studio. Full native, including a
  release-shaped build.

react-native-svg 15.15.5 ships web platform files, and
`@react-native-async-storage/async-storage` 3.1.1 ships a web module with IndexedDB, so
the SVG logos and session storage are genuinely exercised on web; react-native-web 0.21.2
supports the React 19 the demo pins.

## What to look for on screen

- The app boots with no redbox.
- The debug panel shows the registry wallet count, the icon format per wallet, and that
  the two no-argument factory paths (deep link, async storage) resolve rather than throw.
- The wallet list renders REAL logos: the svg logos through react-native-svg's web build,
  the raster logos through Image.
- The theme colors come from the bridge, not React Native defaults.
- Tapping a wallet starts the connect flow: the connecting state appears, and the flow
  surfaces an honest error rather than a fake success when the connect cannot complete.

## Web smoke (required before publishing @partylayer/react-native)

```bash
cd demos/expo-connect
pnpm run prepare-local && pnpm install --ignore-workspace
pnpm run web-smoke
```

`web-smoke` exports the app for web, serves it, and drives it with Playwright (resolved
from the repo root): it boots the app, opens the wallet list, and asserts the
react-native-svg and Image renderers both work with NO uncaught page error. This is the
check that catches a reversion to bundler-invisible module loading (see below), which is
why it is a required pre-publish step in `docs/releasing.md`. The mocked unit tests cannot
catch that class of bug because they inject the modules through test seams.

## Web run results (headless, driven with Playwright)

Verified on the web target (static export served locally, driven headlessly):

- The app boots with no error overlay. The ConnectButton renders.
- The debug panel shows the live registry returning its wallet list, and the icon format
  per wallet.
- The theme is applied from the bridge, not React Native defaults.
- The wallet list opens and its rows render their real logos: the svg logos
  (console, loop, cantor8, bron, nightly) through react-native-svg's web build, and the
  raster logo (send) through Image.
- Calling `createReactNativeDeepLinkPlatform()` and the `./async-storage`
  `createAsyncStorage()` with NO argument both resolve on web, confirming the two
  previously latent loader paths.

### Fixed: bundler-invisible module loading

An earlier run found that opening the wallet list threw
`react-native-svg is required by @partylayer/react-native/ui` and unmounted the app,
because the loader read `require` through a variable so a bundler (Metro, and Metro on
web) could not see the module id and never bundled react-native-svg. The same pattern
sat latent in the deep link and storage loaders. This is now fixed: the ui statically
imports react-native-svg, the deep link platform defaults to a static `react-native`
import, and a `./async-storage` subpath statically imports AsyncStorage for the
no-argument path. The web smoke above now passes.

### SVG responses are validated before rendering

WalletIcon fetches an svg url and validates that the body really is SVG before rendering
it through react-native-svg's `SvgXml`. A response that is not SVG, or a failed fetch,
renders the neutral glyph instead, so a row always shows a mark and never a letter or a
blank. The web smoke asserts that every wallet renders either its real logo or the neutral
glyph. Every icon the stable registry currently claims is present and serves its real
image, so the fallback is the safety net rather than the normal path.
