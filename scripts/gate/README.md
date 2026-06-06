# Regression Safety Gate

A mechanical safety net that guarantees we never silently break the wallet
adapters or the existing public API while the SDK evolves toward the native
CIP-0103 path. **Pure infrastructure — it adds no runtime behaviour.**

## The single command

```bash
pnpm gate
```

`pnpm gate` is the source of truth for "is everything still safe". It runs, in
order:

1. `pnpm gate:build` — builds `@partylayer/*` (scoped like `ci.yml`, so a
   transiently broken example/consumer can't block the gate)
2. `pnpm typecheck` — all packages
3. `pnpm lint` — all packages
4. `pnpm gate:test` — all unit tests (`CI=true` forces single-run, no watch)
5. `pnpm gate:conformance` — CIP-0103 **native-path** conformance
6. `pnpm gate:api` — public-API surface snapshot diff
7. `pnpm gate:registry` — registry integrity + cip0103 footgun guard

> **Why build runs first.** Workspace packages resolve `@partylayer/*` imports
> to each other's built `dist/*.d.ts`, so `typecheck`, the unit tests, the
> conformance check, and the API snapshot all need a fresh build present. The
> repo's existing `ci.yml` builds before typechecking for the same reason.

CI runs this exact command on every PR to `main` (see
`.github/workflows/regression-gate.yml`).

## Sub-commands

| Command | What it does |
|---|---|
| `pnpm gate:conformance` | Runs the published CIP-0103 conformance suite against the **native** `PartyLayerProvider`, wrapping an in-repo reference wallet. Fails on any non-conformant result. |
| `pnpm gate:api` | Diffs each published package's **type surface** (`<pkg>.api.d.ts`, Prettier-normalized) **and packaging surface** (`<pkg>.pkg.json`) against committed snapshots. Fails on any change to a public export, a `peerDependencies` range, an `exports` subpath, `bin`, etc. |
| `pnpm gate:api:update` | **Intentionally** accepts API/packaging changes by rewriting both snapshot kinds. Run this (and commit) when a change is deliberate. |
| `pnpm gate:registry` | Validates `registry/v1/{stable,beta}/registry.json` against `tooling/registry-schema/registry.schema.json` and asserts CIP-0103-native wallets keep their `cip0103.native` flag. |

## How to intentionally update the API snapshot

When you *mean* to change a public API:

```bash
pnpm gate:build          # produce fresh dist/*.d.ts
pnpm gate:api:update     # rewrite tooling/api-snapshots/*.api.d.ts + *.pkg.json
git add tooling/api-snapshots
git commit -m "chore(api): accept public-API/packaging change for <pkg>"
```

Reviewers see the exact delta (type surface and/or packaging) in the diff of
the snapshot files — that is the whole point.

## What is snapshotted, and the snapshot set

Two committed artifacts per package, under `tooling/api-snapshots/`:

- **`<pkg>.api.d.ts`** — the published `.d.ts` (the `types`/`exports` entry),
  run through Prettier (repo config) before both writing and diffing so
  cosmetic ordering/whitespace can never cause a false failure.
- **`<pkg>.pkg.json`** — normalized JSON of `{ name, main, module, types,
  exports, bin, peerDependencies }`. **`version` is excluded** (it changes
  every release and isn't part of the consumer contract). Keys are sorted
  recursively. This catches packaging breakage — a tightened `peerDependencies`
  range or a removed `exports` subpath — that never appears in the `.d.ts`.

The set is **auto-discovered**: every workspace package with `"private": false`
and a `"types"` entry, minus `EXCLUDED_PACKAGES` in `api-snapshot.mjs`. New
publishable packages (e.g. `@partylayer/session`) are picked up automatically.

## How to add a new CIP-0103-native wallet

When a wallet is confirmed CIP-0103 native, in the **same PR**:

1. Add `"cip0103": { "native": true, "evidence": "<url>", "since": "<date>" }`
   to its registry entry.
2. Add its `id` to `REQUIRED_CIP0103_NATIVE` (per channel) in
   `scripts/gate/registry-check.mjs`.

This keeps the footgun guard in lock-step with the registry.

## Design choices

- **API snapshot = d.ts rollup, not API Extractor.** The `@partylayer/*`
  packages build with `tsup`, which already emits a single bundled
  `dist/index.d.ts` containing the full public type surface. That bundled file
  *is* the published contract, so snapshotting it (Prettier-normalized) is
  faithful and deterministic without adding heavy tooling.
- **Registry check is shape/required-field, not a frozen diff.** Registry
  content grows additively; the gate only enforces structure + the cip0103
  footgun guard.
- **Native-path conformance uses an in-repo reference wallet** (the
  `createProviderBridge(mockClient)` construction already used by the provider
  package's own conformance-gate test), so no live wallet is required.

## Excluded packages

`@partylayer/adapter-starter` is **excluded from the API gate**
(`EXCLUDED_PACKAGES` in `api-snapshot.mjs`). It is a copy-me template, not a
runtime dependency of any dApp, and it builds with `tsc` (not `tsup`) — its
`index.d.ts` only re-exports from sibling files rather than inlining the full
surface, so a snapshot would be half-protection (entry file only) and a source
of false failures. The eleven `tsup`-built packages (core, provider, react,
sdk, registry-client, and all six adapters) get full rolled-up surfaces.
