# create-partylayer-app

## 0.1.1

### Patch Changes

- Fix the broken 0.1.0 publish: the tarball shipped without `dist/`, so the `bin` target was missing and `npm create partylayer-app` failed with exit 127.

  Root cause: `tsc` inherits `composite`/`incremental` from the root tsconfig, and `clean` only removed `dist/` (not `tsconfig.tsbuildinfo`). A stale buildinfo made `tsc` skip emit, so a publish from that state produced an empty `dist/`. Fix: `clean` now also wipes `*.tsbuildinfo`, and a `prepublishOnly: "pnpm run clean && pnpm run build"` guard guarantees a fresh `dist/` in every tarball. Verified: a dry-run publish from the exact broken state now packs `dist/index.js`.

## 0.1.0

### Minor Changes

- 25e8345: Initial release of `create-partylayer-app` — the PartyLayer dApp scaffolder.

  `npm create partylayer-app@latest` (also `pnpm`/`yarn create`) spins up a working Canton dApp. Ships the **react-vite** template: React 18 + Vite + zero-config `PartyLayerKit` + `ConnectButton`, wired to connect any registry-verified wallet. Interactive prompts (project dir → template → package manager) with non-interactive flags (`--template`, `--pm`, `--no-install`, `--no-git`) for CI.
