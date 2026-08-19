# @partylayer/react-native

React Native support for PartyLayer, with the same mental model as the web package: a
provider at the root, hooks that need no arguments, and components that need no props.

Two entrypoints. `.` is headless: the client factory, storage, the hooks, and the theme
bridge. `./ui` adds the connect components, which need the SVG renderer, so an app using
only the hooks never installs it.

## Install

```
npm install @partylayer/react-native
```

Peer dependencies:

- `react` and `react-native` (broad ranges).
- `@react-native-async-storage/async-storage` (optional; needed for session persistence and
  for the storage factories).
- `react-native-svg` (optional; needed only for the `./ui` entrypoint).

## A complete minimal app

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, Text } from 'react-native';
import {
  createReactNativeClient,
  PartyLayerProvider,
  ThemeProvider,
  useAccount,
} from '@partylayer/react-native';
import { ConnectButton } from '@partylayer/react-native/ui';

const client = createReactNativeClient({
  network: 'devnet',
  app: { name: 'My RN dApp' },
  asyncStorage: AsyncStorage,
});

function Account() {
  const { party, isConnected } = useAccount();
  return <Text>{isConnected ? party : 'Not connected'}</Text>;
}

export default function App() {
  return (
    // `asyncStorage` here is what makes the session survive an app restart. See below.
    <PartyLayerProvider client={client} asyncStorage={AsyncStorage}>
      <ThemeProvider theme="auto">
        <SafeAreaView>
          <Account />
          <ConnectButton />
        </SafeAreaView>
      </ThemeProvider>
    </PartyLayerProvider>
  );
}
```

The client is created once, outside the component, so it is stable. Creating it inside a
component body makes a new client on every render, which resets the hooks.

## Session persistence: read this once

**On React Native a session does not survive an app restart unless you wire storage.**

The shared session store defaults to encrypted IndexedDB where it exists and falls back to
in-memory otherwise. React Native has no IndexedDB, so the fallback is what you get, and
in-memory is gone the moment the app is killed. The user reconnects on every launch.

Pass `asyncStorage` to `PartyLayerProvider` and the session persists:

```tsx
<PartyLayerProvider client={client} asyncStorage={AsyncStorage}>
```

Two notes. This is separate from the `asyncStorage` you pass to `createReactNativeClient`,
which persists the sdk client's own session record; the provider's prop is what backs the
session store the hooks read. Passing both is the normal setup, as in the example above. If
you need full control, `sessionOptions.storage` overrides the prop:

```tsx
import { createAsyncStorage } from '@partylayer/react-native/async-storage';

<PartyLayerProvider client={client} sessionOptions={{ storage: createAsyncStorage() }}>
```

## Hooks

Every hook below takes the client from `PartyLayerProvider`. The client-based ones also
accept an explicit client, so they work with no provider at all.

### useAccount

Who is connected. Requires the provider.

```tsx
const { party, address, account, accounts, status, isConnected, networkId, chain } = useAccount();
```

`party` is the active party id, `address` is its alias for parity with the web package,
`status` is `'disconnected' | 'connecting' | 'reconnecting' | 'connected'`, and `chain` is
`{ id }` derived from `networkId`.

### useSession

The full session state plus the store's actions. Requires the provider.

```tsx
const { status, account, isConnected, connect, disconnect, restore, on } = useSession();
```

`connect`, `disconnect`, `restore` and `on` are stable per store, so they are safe in a
dependency array.

### useAccountEffect

Side effects on transitions, with no re-render. Requires the provider.

```tsx
useAccountEffect({
  onConnect: ({ account, networkId }) => console.log('connected', account, networkId),
  onDisconnect: () => console.log('disconnected'),
  onPartyChanged: ({ previous, current }) => console.log(previous, current),
});
```

`onConnect` fires once per session, on the tick where the account is actually available.

### useConnect

The connect flow against the client.

```tsx
const { connect, disconnect, session, status, isConnecting, isConnected, error } = useConnect();
```

### useDisconnect

```tsx
const { disconnect, isDisconnecting, error } = useDisconnect();
```

### useWallets

The registry wallet list, with per-wallet icon data.

```tsx
const { wallets, walletIcons, isLoading, isSuccess, isError, error, refetch } = useWallets();
const withSigning = useWallets({ filter: { requiredCapabilities: ['signMessage'] } });
```

### useSignMessage, useSignTransaction, useSubmitTransaction, useLedgerApi

```tsx
const { signMessage, isSigning, error, reset } = useSignMessage();
const { submitTransaction, isSubmitting } = useSubmitTransaction();
const { signTransaction } = useSignTransaction();
const { ledgerApi, isLoading } = useLedgerApi();
```

These reject on failure and record the error, matching `useConnect` in this package.

They add no capability checking of their own. The sdk client guards each of these methods
and throws `CapabilityNotSupportedError` before reaching the adapter, so a wallet that does
not advertise a capability produces that typed error here, the same one the web path
produces:

```tsx
import { CapabilityNotSupportedError } from '@partylayer/core';

try {
  await signMessage({ message: 'hello' });
} catch (err) {
  if (err instanceof CapabilityNotSupportedError) {
    // This wallet does not advertise signMessage.
  }
}
```

### useTheme

The current theme. Falls back to the default light theme when there is no `ThemeProvider`,
so it never throws.

```tsx
const theme = useTheme();
```

## Components, from "./ui"

`ConnectButton`, `ConnectModal`, `WalletList`, `WalletIcon`, and the chrome icons
(`Spinner`, `CloseIcon`, `BackIcon`, `ErrorIcon`).

`ConnectModal` is the whole connect flow: the wallet list, a loading state, a failure state
with a retry, and it dismisses on success. Under the providers it takes no props but its
visibility:

```tsx
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ConnectModal } from '@partylayer/react-native/ui';

function Connect() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Text>Connect</Text>
      </Pressable>
      <ConnectModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

`ConnectButton` already opens it for you, so most apps only need the button.

**Safe areas.** The sheet takes an optional `insets` prop and pads its bottom by it. This
is a prop rather than a dependency, because the core `SafeAreaView` is deprecated and
`react-native-safe-area-context` would be a new peer. If your app already has real insets,
pass them and the sheet is exact on any device; otherwise it uses a conservative platform
default:

```tsx
<ConnectModal visible={open} onClose={close} insets={{ bottom: 34 }} />
```

**Accessibility.** The sheet is marked as a modal for screen readers, its state region is a
polite live region so loading, connecting and failure are announced, and the slide
animation is dropped when the OS reduce motion setting is on.

**Wallet logos, always real, never letters.** PNG and JPG render through React Native's
`Image`; SVG renders through react-native-svg. An unknown format or a load failure falls
back to a neutral wallet glyph, never a letter.

**No QR screen.** The web modal has a QR view so a desktop user can scan with a phone. On a
phone there is nothing to scan, so the list omits it. Selecting a wallet calls
`client.connect` with that wallet id, and the registered adapter decides how it reaches its
wallet.

**react-native-svg is required for `./ui`.** It is an optional peer, so the headless `.`
entrypoint never pulls it in. Install it when you use `./ui`:

```
npm install react-native-svg
```

## Theming

`ThemeProvider` accepts `'light'`, `'dark'`, `'auto'`, a `PartyLayerTheme` from the shared
catalog, an already adapted `ReactNativeTheme`, or a `{ lightMode, darkMode }` pair.
`'auto'` and the pair form follow the OS preference.

```tsx
import { ThemeProvider, themes, toReactNativeTheme, applyAccent } from '@partylayer/react-native';

<ThemeProvider theme="auto">{children}</ThemeProvider>
<ThemeProvider theme={themes.midnight.dark}>{children}</ThemeProvider>
<ThemeProvider theme={toReactNativeTheme(applyAccent(themes.default.dark, { accentColor: '#7c3aed' }))}>
  {children}
</ThemeProvider>
```

The provider composes with the per component `theme` prop: the prop wins, then the
provider, then the default. `toReactNativeTheme` adapts a `PartyLayerTheme` for React Native
(colors pass through, `borderRadius` becomes a number, `overlayBlur` becomes an opaque
`overlay`, and `primaryHover` is exposed as `colors.pressed`).

## Storage without passing the module ("./async-storage")

The `./async-storage` subpath statically imports
`@react-native-async-storage/async-storage` and exposes the storage factories with no
argument:

```ts
import { createAsyncStorage, createAsyncStorageAdapter } from '@partylayer/react-native/async-storage';

const sessionStorage = createAsyncStorage();
const storage = createAsyncStorageAdapter();
```

On the `.` entrypoint the same two factories take the AsyncStorage module as a required
argument, which keeps the optional peer out of the headless entry.

## Deep link building block

`createReactNativeDeepLinkPlatform` implements the core `DeepLinkPlatform` on React
Native's `Linking`: `openUrl` opens a URL, `subscribe` receives inbound callback URLs, and
it consults `getInitialURL` so a callback that cold started the app is still delivered.

It is a building block for authors writing their own `WalletAdapter` for a wallet that
connects over a deep link. Pair it with core's `DeepLinkTransport` and register the adapter
through `adapters`:

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

## Upgrading from 0.2.2

**Nothing you use has changed.** Every export from 0.2.2 is still exported, with the same
behavior:

- `useConnect(client)` and `useWallets(client, parameters)` still take an explicit client
  and still work with no provider anywhere in the tree. The provider forms are additional
  overloads, not replacements.
- `ConnectButton`, `WalletList` and `WalletIcon` still accept `client` and `theme` as
  props. Those props are now optional so they can come from the providers instead, which is
  a widening: passing them keeps working exactly as before.
- `createReactNativeClient`, `createReactNativeDeepLinkPlatform`, the storage factories, the
  theme bridge and the icon helpers are unchanged.

So an upgrade is a version bump. Adopt the provider when you want to, file by file.

Two things worth doing after the bump:

1. **Wire session persistence.** Add `asyncStorage={AsyncStorage}` to `PartyLayerProvider`
   once you adopt it. Without it, on React Native the session store is in-memory and the
   user reconnects on every app launch. This was true in 0.2.2 as well; it is simply
   documented and fixable now.
2. **Hold the client still.** If you construct the client inside a component body, move it
   to module scope or a `useMemo`. A new client identity on each render is treated as a
   client swap and resets the hooks.

If you want `ConnectModal`, use it in place of `WalletList`; `WalletList` now delegates to
it, so both behave the same.
