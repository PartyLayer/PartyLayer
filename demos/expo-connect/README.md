# PartyLayer Expo connect demo (phase C1)

The first real runtime of `@partylayer/react-native`. Phases A, B1, and B2 were tested
with the React Native modules mocked; this Expo app runs the actual `ConnectButton` and
`WalletList` on a device or simulator, against local builds of our packages.

It lives OUTSIDE the pnpm workspace (in `demos/`, which no workspace glob matches) with
its own lockfile, because Expo 57 pins React 19 and react-native 0.86 while the workspace
runs React 18. The two dependency universes must not mix.

## Honest scope

This demo proves the UI, the live registry fetch, the theme, the icon rendering, and the
deep link launch. Completing an end to end connect additionally requires a Canton wallet
app installed on the device, which a demo cannot assume. A connect that cannot complete
renders the error path honestly; nothing here fakes a successful connect.

## Why local package builds (not npm)

`@partylayer/core` 0.11.0 on npm does NOT contain `DeepLinkPlatform` or
`createBrowserDeepLinkPlatform` (added in phase A, unpublished), yet it carries the same
0.11.0 version number, so a plain install would silently resolve the wrong copy. And
`@partylayer/react-native` is unpublished entirely. So the demo packs local builds into
`vendor/` and forces every `@partylayer` package to those tarballs through pnpm
`overrides`. The debug panel and `verify-core.mjs` both confirm the local core loaded.

## Run it

Requirements: Node, pnpm, and one of an iOS simulator (Xcode), an Android emulator
(Android SDK), or the Expo Go app on a physical phone.

```bash
cd demos/expo-connect
pnpm run prepare-local     # build + pack the local PartyLayer tarballs into vendor/
pnpm install               # own lockfile; resolves the tarballs via overrides
pnpm run verify-core       # headless check that the local core loaded (optional)

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
  browser. Proves the components render, the theme from the bridge is applied, the live
  registry fetch works, and the flow logic. It does NOT prove native module bindings:
  `Linking.openURL` maps to a browser navigation rather than a native intent or universal
  link, and AsyncStorage uses IndexedDB rather than the native store.
- **Expo Go on a phone**, needs only the Expo Go app. Proves the native deep link handoff
  and native storage, on a real OS, without a full toolchain.
- **Simulator or emulator**, needs Xcode or Android Studio. Full native, including a
  release-shaped build.

react-native-svg 15.15.5 ships web platform files, and
`@react-native-async-storage/async-storage` 3.1.1 ships a web module with IndexedDB, so
the SVG logos and session storage are genuinely exercised on web; react-native-web 0.21.2
supports the React 19 the demo pins.

## What to look for on screen

- The app boots with no redbox.
- The debug panel shows the local core loaded (DeepLinkPlatform present), the registry
  wallet count, and the icon format per wallet.
- The wallet list renders REAL logos. walletconnect's CDN icon is missing, so its row
  shows the neutral fallback glyph, never a letter.
- The theme colors come from the bridge, not React Native defaults.
- Tapping a wallet starts the connect flow. On a phone with the wallet app installed, the
  OS opens that app through the deep link; without it, the launch is the observable
  outcome and the flow surfaces an honest error rather than a fake success.

## Web run results (headless, driven with Playwright)

Verified on the web target (static export served locally, driven headlessly):

- The app boots with no error overlay. The ConnectButton renders.
- The debug panel shows the LOCAL core loaded (createBrowserDeepLinkPlatform present),
  the live registry returning its wallet list, and the icon format per wallet.
- The theme is applied from the bridge: the heading text is the dark theme text color
  and the debug panel uses the dark theme surface color, not React Native defaults.

Found and reported (not fixed here): opening the wallet list throws
`react-native-svg is required by @partylayer/react-native/ui`, which unmounts the app.
The `./ui` svg loader resolves react-native-svg through a dynamic `require` read from a
variable, which a bundler (Metro on web and native) cannot see, so react-native-svg is
never bundled at that call site even though it is installed. This affects every Metro
consumer of the ui entrypoint, and the mocked B2 tests missed it because they inject the
components. So on web the wallet list, the SVG logos, the neutral fallback, the tap
interaction, and the error path remain UNVERIFIED pending a fix to the loader. The
headless storage and deep link loaders share the pattern but are not triggered here
because this demo passes those modules in explicitly.
