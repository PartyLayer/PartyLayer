---
"@partylayer/sdk": patch
"@partylayer/conformance-runner": patch
---

Fix: replace runtime `require()` of workspace packages with proper ESM imports
so browser/ESM consumers don't crash.

`PartyLayerClient.asProvider()` did a runtime
`require('@partylayer/provider')`. In the ESM build that hits esbuild's
`__require` shim and throws **"Dynamic require of \"@partylayer/provider\" is
not supported"** in browser bundles (Next dev **and** production), crashing
`PartyLayerKit` on mount (`asProvider()` is called from the React provider).
It now uses a top-of-file static `import { createProviderBridge } from
'@partylayer/provider'` — `asProvider()` stays synchronous with the same
`CIP0103Provider` return type, and there is no dependency cycle
(`@partylayer/provider` does not import `@partylayer/sdk`).

`@partylayer/conformance-runner` (an ESM `type: module` CLI) used the `require`
global (`require.resolve(...)` and a `require(adapterPath)` CJS fallback) in its
adapter loader, which is undefined at runtime in ESM. It now derives a real Node
require via `createRequire(import.meta.url)`.
