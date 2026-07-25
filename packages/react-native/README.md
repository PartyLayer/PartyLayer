# @partylayer/react-native

Headless React Native compatibility layer for PartyLayer. Phase A: the platform pieces
that let the framework-agnostic core run on React Native. No UI components; those and an
Expo demo follow in later phases.

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
