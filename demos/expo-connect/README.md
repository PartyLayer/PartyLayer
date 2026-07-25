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

pnpm run ios               # iOS simulator (needs full Xcode)
pnpm run android           # Android emulator (needs the Android SDK)
pnpm start                 # then scan the QR with Expo Go on a phone
```

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
