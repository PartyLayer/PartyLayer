# @partylayer/react-native

React Native support for PartyLayer. The `.` entrypoint is headless (platform pieces,
theme bridge, and hooks); the `./ui` entrypoint adds the connect UI components. The two
are separate so a dApp using only the hooks never has to install the SVG renderer.

## What it provides

- `createReactNativeDeepLinkPlatform(Linking?)`: a core `DeepLinkPlatform` built on
  React Native's `Linking` API (`openURL`, `addEventListener('url')`, `getInitialURL`).
  A building block for adapter authors, see "Deep link building block" below.
- `createAsyncStorage(AsyncStorage)`: a `SessionStorage` backed by
  `@react-native-async-storage/async-storage`, with a clear error when the module passed
  to it is missing or invalid.
- `createAsyncStorageAdapter(AsyncStorage)`: the core `StorageAdapter` variant used by
  the client factory.
- `createReactNativeClient(config)`: a headless client that wires the sdk with
  AsyncStorage session persistence, so a dApp gets a working connect flow with no UI.

On the `.` entrypoint both storage factories take the AsyncStorage module as a required
argument, which keeps the optional peer out of the headless entry. The `./async-storage`
subpath provides the same two factories with no argument, see below.

## Peer dependencies

- `react` and `react-native` (broad ranges).
- `@react-native-async-storage/async-storage` (optional; needed only for the storage
  pieces).
- `react-native-svg` (optional; needed only for the `./ui` entrypoint).

## Usage

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createReactNativeClient } from '@partylayer/react-native';

const client = createReactNativeClient({
  network: 'devnet',
  app: { name: 'My RN dApp' },
  asyncStorage: AsyncStorage,
});
```

When both `storage` and `asyncStorage` are given, the explicit `storage` is used. With
neither, the client uses the sdk default, so the optional AsyncStorage peer is never
forced.

## Storage without passing the module ("./async-storage")

The `./async-storage` subpath statically imports
`@react-native-async-storage/async-storage` and exposes the same two factories with no
argument. Use it when you have the peer installed and would rather not thread the module
through your own code:

```ts
import {
  createAsyncStorage,
  createAsyncStorageAdapter,
} from '@partylayer/react-native/async-storage';

const sessionStorage = createAsyncStorage();
const storage = createAsyncStorageAdapter();
```

Importing this subpath makes the AsyncStorage peer required, which is why the `.`
entrypoint keeps the argument form.

## Deep link building block

`createReactNativeDeepLinkPlatform` implements the core `DeepLinkPlatform` interface on
React Native's `Linking`: `openUrl` opens a URL, `subscribe` receives inbound callback
URLs while the app runs, and it consults `getInitialURL` so a callback that cold started
the app is still delivered.

It is a building block for authors writing their own `WalletAdapter` for a wallet that
connects over a deep link. Pair it with core's `DeepLinkTransport`, which builds the URL
and matches the callback `state`, then register the adapter through `adapters`:

```ts
import { DeepLinkTransport } from '@partylayer/core';
import { createReactNativeDeepLinkPlatform, createReactNativeClient } from '@partylayer/react-native';

const transport = new DeepLinkTransport(createReactNativeDeepLinkPlatform());

// Inside your WalletAdapter's connect():
const response = await transport.openConnectRequest(
  'mywallet://connect',
  { appName: 'My RN dApp', origin: 'myapp://', network: 'devnet', state },
  { origin: 'myapp://', timeoutMs: 120_000 },
);

const client = createReactNativeClient({
  network: 'devnet',
  app: { name: 'My RN dApp' },
  adapters: [myDeepLinkAdapter],
});
```

The client factory takes no deep link platform of its own: an adapter that needs one
constructs it, as above.

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

**No QR screen.** The web modal has a QR view so a desktop user can scan with a phone. On
a phone there is nothing to scan, so the list omits it. Selecting a wallet calls
`client.connect` with that wallet id, and the registered adapter decides how it reaches
its wallet.

`WalletList` covers the wallet list, the connecting state (a spinner plus the wallet
being connected, cancellable), and the error state (a message plus retry). On success the
modal dismisses and `ConnectButton` reflects the session.
