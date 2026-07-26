---
"@partylayer/react-native": minor
---

Load the optional peers through static imports so a bundler can see them. The loaders
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
