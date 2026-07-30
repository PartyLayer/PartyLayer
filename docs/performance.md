# Performance

> Published on the docs site: [partylayer.xyz/docs/performance](https://partylayer.xyz/docs/performance).

This document is anchored to measurements, not advice. Every number here is reproducible
with `pnpm gate:size` (the bundle scenarios) or the commands noted in each section.

## Measured baseline: raw dist per package

Total JavaScript shipped in each package's `dist` (CommonJS `.js` plus ESM `.mjs`),
measured at the versions released on 2026-07-26. This is the whole package, not what a
consumer bundles.

| Package | dist JS (js + mjs) | index.js alone |
|---|---|---|
| @partylayer/react | 335 KB | 142 KB |
| @partylayer/sdk | 137 KB | 71 KB |
| @partylayer/provider | 74 KB | 37 KB |
| @partylayer/core | 71 KB | 36 KB |
| @partylayer/react-native | 60 KB | 12 KB |
| @partylayer/session | 52 KB | 26 KB |
| @partylayer/registry-client | 36 KB | 18 KB |

Package size is not what a dApp ships. What a dApp ships is the tree shaken, minified, and
gzipped cost of the exports it actually imports. That is measured below.

## What each import scenario costs

Measured with `size-limit` (esbuild bundler, gzip). Peer dependencies (React, React Query,
React Native, react-native-svg, AsyncStorage) are treated as external because the consuming
app already ships them, so each number is PartyLayer's marginal contribution. Binary assets
imported transitively by wallet SDKs (icons, fonts) are mapped to esbuild's empty loader,
because a web bundler emits those as separate files rather than inlining them into the
JavaScript bundle.

The "before" column is the same measurement with no `sideEffects` field declared. The
"after" column is with `"sideEffects": false` declared on the library packages.

| Scenario | Import | Before | After | Change |
|---|---|---|---|---|
| Connect surface | `{ PartyLayerProvider, ConnectButton }` from `@partylayer/react` | 47,152 B | 29,220 B | -38.0% |
| One token hook | `{ useTokenHoldings }` from `@partylayer/react/query` | 1,004 B | 455 B | -54.7% |
| Matching helper | `{ tokenDecimalEquals }` from `@partylayer/react/query` | 849 B | 283 B | -66.7% |
| RN headless | `{ createReactNativeClient }` from `@partylayer/react-native` | 42,324 B | 42,217 B | -0.25% |
| RN ui | `{ ConnectButton }` from `@partylayer/react-native/ui` | 2,970 B | 2,970 B | 0% |
| SDK client | `{ createPartyLayer }` from `@partylayer/sdk` | 42,130 B | 42,022 B | -0.26% |

Reading of the numbers:

- The `@partylayer/react` package holds many independent hooks and components, so declaring
  it free of load time side effects is what lets a bundler drop the exports a scenario does
  not touch. The connect surface drops 38 percent, and a single token hook or the matching
  helper drop by half or more.
- `tokenDecimalEquals` reaches 283 B because its module imports nothing. It is now close to
  free, which is the expected result for a pure string comparison helper.
- The React Native and SDK entrypoints barely move. `createReactNativeClient` and the ui
  `ConnectButton` are already single purpose, and `createPartyLayer` statically wires the
  built in wallet adapters, which is a deliberate design choice rather than unused code a
  bundler could remove. Their `sideEffects` declaration is still correct and guards against
  future regressions, but there was little unused code to drop today.

### The react-native ui scenario and its measurement caveat

The ui entrypoint imports `react-native` and `react-native-svg`, which only resolve inside
a React Native bundler (Metro), not a web bundler. The size-limit config marks those and
the other React Native peers as external, so the 2,970 B figure is the cost of PartyLayer's
own ui code, not a runnable React Native bundle. The genuine on device runtime is verified
separately by the Expo demo web smoke described in `demos/expo-connect/README.md` and in
`docs/releasing.md`.

## Budgets and where they are enforced

Budgets are set slightly above the current measurement so they act as regression guards
rather than aspirations that fail on day one. They live in `.size-limit.js` at the repo
root and run as the `gate:size` stage of `pnpm gate`, right after `gate:build` (the stage
needs the built `dist`). A change that inflates a bundle past its budget fails locally and
in CI rather than reaching a consumer.

| Scenario | Measured | Budget | Headroom |
|---|---|---|---|
| Connect surface | 29.22 KB | 30 KB | ~5% |
| One token hook | 455 B | 700 B | ~54% |
| Matching helper | 283 B | 500 B | ~77% |
| RN headless | 42.22 KB | 43 KB | ~4% |
| RN ui | 2.97 KB | 3.5 KB | ~18% |
| SDK client | 42.02 KB | 43 KB | ~5% |

The large entrypoints carry roughly 5 percent headroom, tight enough to catch a real
regression. The tiny helper entrypoints carry more relative headroom because a few hundred
bytes of normal churn swing their percentage sharply.

Run the check on its own with `pnpm gate:size`, or `pnpm size` during development.

## Tree shaking requirements for consumers

The budgets above are only achievable if the consuming app lets the bundler shake the tree.

- Import named exports from the package or its subpath, for example
  `import { useTokenHoldings } from '@partylayer/react/query'`. Every publishable library
  package declares `"sideEffects": false`, so a bundler may drop any module whose exports
  you do not use.
- Do not use namespace imports such as `import * as PartyLayer from '@partylayer/react'`. A
  namespace import references the whole module object and prevents the bundler from dropping
  unused exports.
- Use the ESM build. The packages ship both CommonJS and ESM through the `exports` map, and
  bundlers pick ESM automatically. A CommonJS `require` cannot be tree shaken.
- Prefer the narrowest subpath. `@partylayer/react/query` carries the data hooks without the
  connect UI, and `@partylayer/react-native` (headless) carries no SVG renderer, which lives
  behind `@partylayer/react-native/ui`.
- The three command line packages (`create-partylayer-app`, `@partylayer/registry-cli`,
  `@partylayer/conformance-runner`) do not declare `sideEffects` because their entry runs on
  load by design. They are run as commands, not imported, so tree shaking does not apply.

## Caching already provided by the registry client

`@partylayer/registry-client` implements stale while revalidate caching, so an app does not
refetch the wallet registry on every call. It is configurable through `RegistryClientOptions`:

- `cacheTtl` (default 1 hour): while the cached registry is younger than this, it is served
  directly with no network request.
- `staleTtl` (default 24 hours): once older than `cacheTtl` but younger than `staleTtl`, the
  cached copy is served and marked stale while a refresh happens.
- `storage`: a pluggable adapter, so the cache can persist across sessions rather than
  living only in memory.

These are knobs on the existing client, not something an app has to build.

## Lazy loading already in place

Heavy or rarely needed modules are loaded on demand with dynamic `import`, so they never
enter the initial bundle:

- `packages/react/src/modal.tsx` imports `qrcode` only when a QR code is about to render.
- `packages/sdk/src/client.ts` imports the `OriginNotAllowedError` class from
  `@partylayer/core` only on the error path.
- `packages/conformance-runner` loads `@partylayer/provider` and the modules under test
  dynamically at run time.
