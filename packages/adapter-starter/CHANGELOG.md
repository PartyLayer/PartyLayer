# @partylayer/adapter-starter

## 0.1.20

### Patch Changes

- 77763c2: Build with tsup, so the package is importable at all.

  The exports map named `./dist/index.mjs`, but the build was two `tsc` passes that never emitted it. The first pass inherited `module: ESNext` from the root config and wrote ESM into `dist/*.js`; the second pass used the same module setting and the same `outDir`, so it rewrote those same files, and `tsc` does not emit `.mjs`. The result was that both entry conditions were broken: `import` resolved to a file that did not exist, and `require` resolved to a file that was ESM, carrying extensionless relative specifiers that Node cannot resolve. Both failed with ERR_MODULE_NOT_FOUND.

  The package now builds with tsup, like every other adapter in this repository, which emits `dist/index.js` as CJS, `dist/index.mjs` as ESM and the declarations, exactly matching the existing exports map. `type: module` is removed so the CJS entry is genuinely CJS, and `files` narrows to `dist`. The starter is meant to be copied by wallet authors, so building it the way the real adapters are built also makes it a faithful template.

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.1.19

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.1.18

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.1.17

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.1.16

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

## 0.1.15

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.1.14

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.1.13

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.1.12

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.1.11

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.1.10

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.1.9

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.3.0

## 0.1.8

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.6

## 0.1.7

### Patch Changes

- Standardize README format with badges and consistent heading.

## 0.1.6

### Patch Changes

- Add repository URLs and README documentation for registry-cli, adapter-starter, and conformance-runner.

## 0.1.5

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/core@0.2.4

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
