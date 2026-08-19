# @partylayer/registry-cli

## 0.1.13

### Patch Changes

- 26d9fd9: Fix the CLI, which could not start, and stop shipping source.

  Same defect as the conformance runner, from the same root cause: the `tsc` build emitted ESM with extensionless relative specifiers, so `partylayer-registry` failed at startup with `ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/registry'`. It now builds with tsup, which bundles the entry. The package stays `type: module`, so the ESM output remains `dist/index.js` and the existing `bin` and `main` targets are unchanged.

  It also had no `files` allowlist, so the tarball carried `src`, `tsconfig.json` and `tsconfig.tsbuildinfo`. Adding `files: ["dist"]` takes it from 26 files to 6.

  Verified by installing the packed tarball in a project outside the repository and running `partylayer-registry --help` from the installed package.
  - @partylayer/registry-client@0.6.3

## 0.1.12

### Patch Changes

- Updated dependencies
  - @partylayer/registry-client@0.6.0

## 0.1.11

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/registry-client@0.5.0

## 0.1.10

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/registry-client@0.4.0

## 0.1.9

### Patch Changes

- Resolve workspace↔npm drift. The workspace version was bumped to `0.1.8`
  during a prior release wave (auto-derived from a `@partylayer/registry-client`
  minor bump), but the package was never published to npm — npm latest
  remained at `0.1.7`. This release publishes the bumped version and updates
  the declared `@partylayer/registry-client` and `@partylayer/core` ranges
  to match the fixed core@0.3.0 / registry-client@0.3.1 cohort. No source
  changes.
- Updated dependencies
  - @partylayer/registry-client@0.3.1

## 0.1.8

### Patch Changes

- Updated dependencies [7770870]
  - @partylayer/registry-client@0.3.0

## 0.1.7

### Patch Changes

- Updated dependencies
  - @partylayer/registry-client@0.2.6

## 0.1.6

### Patch Changes

- Add repository URLs and README documentation for registry-cli, adapter-starter, and conformance-runner.

## 0.1.5

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/registry-client@0.2.4

## 0.1.3

### Patch Changes

- Updated dependencies
  - @partylayer/registry-client@0.2.2

## 0.1.2

### Patch Changes

- @partylayer/registry-client@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies
  - @partylayer/registry-client@0.2.0
