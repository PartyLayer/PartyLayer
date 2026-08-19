# @partylayer/conformance-runner

## 0.2.9

### Patch Changes

- 77763c2: Fix the CLI, which could not start, and stop shipping source.

  The build was two `tsc` passes that emitted ESM carrying extensionless relative specifiers, which Node cannot resolve, so `partylayer-conformance` failed immediately with `ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/loader'`. The package now builds with tsup, which bundles the entry so no unresolvable relative import remains. It stays `type: module`, so the ESM output is still `dist/index.js` and the existing `bin` and `main` targets are unchanged.

  It also had no `files` allowlist, so the tarball carried `src`, the vitest file, both tsconfigs and both tsbuildinfo files. Adding `files: ["dist"]` takes it from 34 files to 23.

  Verified by installing the packed tarball in a project outside the repository and running `partylayer-conformance --help` from the installed package.

- Updated dependencies [f7ee857]
- Updated dependencies [4309023]
- Updated dependencies [4309023]
  - @partylayer/provider@0.5.2
  - @partylayer/core@0.13.0

## 0.2.8

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0
  - @partylayer/provider@0.5.0

## 0.2.7

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @partylayer/core@0.11.0
  - @partylayer/provider@0.4.0

## 0.2.6

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0
  - @partylayer/provider@0.3.2

## 0.2.5

### Patch Changes

- Updated dependencies [a3f2ea4]
  - @partylayer/provider@0.3.0

## 0.2.4

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0
  - @partylayer/provider@0.2.6

## 0.2.3

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0
  - @partylayer/provider@0.2.5

## 0.2.2

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0
  - @partylayer/provider@0.2.4

## 0.2.1

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0
  - @partylayer/provider@0.2.3

## 0.2.0

### Minor Changes

- 32c6c1c: feat: assert session.network is the wallet's effective network

  Add the `checkNetworkTruthfulness` contract: an adapter's `connect()` must
  surface the wallet's EFFECTIVE network in `session.network` (so the SDK can
  detect a network mismatch), not merely echo `ctx.network`. Adapters that
  genuinely cannot read the wallet network are recorded as "network-reported: no"
  in the support matrix rather than silently passing.

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
- Updated dependencies [9642aee]
  - @partylayer/core@0.5.0
  - @partylayer/provider@0.2.1

## 0.1.10

### Patch Changes

- 8532f3d: Fix: replace runtime `require()` of workspace packages with proper ESM imports
  so browser/ESM consumers don't crash.

  `PartyLayerClient.asProvider()` did a runtime
  `require('@partylayer/provider')`. In the ESM build that hits esbuild's
  `__require` shim and throws **"Dynamic require of \"@partylayer/provider\" is
  not supported"** in browser bundles (Next dev **and** production), crashing
  `PartyLayerKit` on mount (`asProvider()` is called from the React provider).
  It now uses a top-of-file static `import { createProviderBridge } from
'@partylayer/provider'`. `asProvider()` stays synchronous with the same
  `CIP0103Provider` return type, and there is no dependency cycle
  (`@partylayer/provider` does not import `@partylayer/sdk`).

  `@partylayer/conformance-runner` (an ESM `type: module` CLI) used the `require`
  global (`require.resolve(...)` and a `require(adapterPath)` CJS fallback) in its
  adapter loader, which is undefined at runtime in ESM. It now derives a real Node
  require via `createRequire(import.meta.url)`.

- Updated dependencies [42c862d]
- Updated dependencies [c18a275]
- Updated dependencies [53b1714]
  - @partylayer/provider@0.2.0
  - @partylayer/core@0.4.0

## 0.1.9

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.3.0
  - @partylayer/provider@0.1.7

## 0.1.7

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.6
  - @partylayer/provider@0.1.3

## 0.1.6

### Patch Changes

- Add repository URLs and README documentation for registry-cli, adapter-starter, and conformance-runner.

## 0.1.5

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/core@0.2.4
  - @partylayer/provider@0.1.1

## 0.1.3

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.0
