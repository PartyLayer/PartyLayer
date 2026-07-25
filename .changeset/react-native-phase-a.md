---
"@partylayer/core": minor
"@partylayer/react-native": minor
---

Add the React Native compatibility layer (phase A), a headless package built on the
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
