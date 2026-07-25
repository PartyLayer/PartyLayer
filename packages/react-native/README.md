# @partylayer/react-native

React Native support for PartyLayer. The `.` entrypoint is headless (platform pieces,
theme bridge, and hooks); the `./ui` entrypoint adds the connect UI components. The two
are separate so a dApp using only the hooks never has to install the SVG renderer.

## What it provides

- `createReactNativeDeepLinkPlatform(Linking?)`: a core `DeepLinkPlatform` built on
  React Native's `Linking` API (`openURL`, `addEventListener('url')`, `getInitialURL`).
- `createAsyncStorage(AsyncStorage?)`: a `SessionStorage` backed by
  `@react-native-async-storage/async-storage`, with a clear error when it is missing.
- `createAsyncStorageAdapter(AsyncStorage?)`: the core `StorageAdapter` variant used by
  the client factory.
- `createReactNativeClient(config)`: a headless client that wires the sdk with
  AsyncStorage session persistence, so a dApp gets a working connect flow with no UI.

## Peer dependencies

- `react` and `react-native` (broad ranges).
- `@react-native-async-storage/async-storage` (optional; needed only for the storage
  pieces).

## Usage

```ts
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createReactNativeClient,
  createReactNativeDeepLinkPlatform,
} from '@partylayer/react-native';

const client = createReactNativeClient({
  network: 'devnet',
  app: { name: 'My RN dApp' },
  asyncStorage: AsyncStorage,
});

const platform = createReactNativeDeepLinkPlatform(Linking);
```

The modules can be passed explicitly (shown above) or loaded from the peer dependencies
when omitted.

## Theme bridge and hooks (headless, from ".")

- `toReactNativeTheme(theme)` adapts a `PartyLayerTheme` for React Native (colors pass
  through, `borderRadius` becomes a number, `overlayBlur` becomes an opaque `overlay`,
  and `primaryHover` is exposed as `colors.pressed`). `themes` holds the six families.
- `applyAccent(theme, overrides)` and `accentPresets` apply a brand accent color, the
  same capability the web theme has.
- `useWallets(client)` and `useConnect(client)` are the headless hooks, with per-wallet
  icon data (`walletIcons`, `deriveIconFormat`).

## Connect UI (from "./ui")

```tsx
import { ConnectButton } from '@partylayer/react-native/ui';
import { toReactNativeTheme, themes } from '@partylayer/react-native';

<ConnectButton client={client} theme={toReactNativeTheme(themes.default.dark)} />;
```

`./ui` provides `ConnectButton`, `WalletList` (the connect modal), `WalletIcon`, and the
core chrome icons (`CloseIcon`, `BackIcon`, `ErrorIcon`, `Spinner`).

**react-native-svg is required for `./ui`.** It renders the SVG wallet logos and the
chrome icons. It is declared as an OPTIONAL peer dependency, so the headless `.`
entrypoint never pulls it in; install it only when you use `./ui`:

```
npm install react-native-svg
```

If it is missing, `./ui` throws a clear developer error rather than crashing.

**Wallet logos, always real, never letters.** PNG and JPG render through React Native's
`Image`; SVG renders through react-native-svg's `SvgUri`. An unknown format or a load
failure falls back to a neutral wallet glyph, never a letter. (This fallback is live
today: walletconnect's icon is currently missing on the CDN.)

**Deep link instead of a QR screen.** The web modal has a QR view so a desktop user can
scan with a phone. On a phone there is nothing to scan, so selecting a wallet opens the
wallet app directly through the deep link transport (phase A). There is no QR screen.

## Deferred (following this PR)

The core connect flow ships here. These refinements follow after the Expo demo proves
the flow on a device: the not-installed, network-mismatch, and detailed success screens;
wallet search and filtering; and the remaining chrome icons.
