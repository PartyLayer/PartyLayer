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

1. `pnpm typecheck` — all packages
2. `pnpm lint` — all packages
3. `pnpm gate:build` — builds `@partylayer/*` (scoped like `ci.yml`, so a
   transiently broken example/consumer can't block the gate)
4. `pnpm gate:test` — all unit tests (`CI=true` forces single-run, no watch)
5. `pnpm gate:conformance` — CIP-0103 **native-path** conformance
6. `pnpm gate:api` — public-API surface snapshot diff
7. `pnpm gate:registry` — registry integrity + cip0103 footgun guard

CI runs this exact command on every PR to `main` (see
`.github/workflows/regression-gate.yml`).

## Sub-commands

| Command | What it does |
|---|---|
| `pnpm gate:conformance` | Runs the published CIP-0103 conformance suite against the **native** `PartyLayerProvider`, wrapping an in-repo reference wallet. Fails on any non-conformant result. |
| `pnpm gate:api` | Diffs each published package's `types` entry point against `tooling/api-snapshots/<pkg>.api.d.ts`. Fails on any public-API change. |
| `pnpm gate:api:update` | **Intentionally** accepts public-API changes by rewriting the snapshots. Run this (and commit) when a public-API change is deliberate. |
| `pnpm gate:registry` | Validates `registry/v1/{stable,beta}/registry.json` against `tooling/registry-schema/registry.schema.json` and asserts CIP-0103-native wallets keep their `cip0103.native` flag. |

## How to intentionally update the API snapshot

When you *mean* to change a public API:

```bash
pnpm gate:build          # produce fresh dist/*.d.ts
pnpm gate:api:update     # rewrite tooling/api-snapshots/*.api.d.ts
git add tooling/api-snapshots
git commit -m "chore(api): accept public-API change for <pkg>"
```

Reviewers see the exact public-API delta in the diff of the snapshot files —
that is the whole point.

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
  *is* the published contract, so snapshotting it verbatim is faithful and
  deterministic without adding heavy tooling.
- **Registry check is shape/required-field, not a frozen diff.** Registry
  content grows additively; the gate only enforces structure + the cip0103
  footgun guard.
- **Native-path conformance uses an in-repo reference wallet** (the
  `createProviderBridge(mockClient)` construction already used by the provider
  package's own conformance-gate test), so no live wallet is required.

## Known limitation

`@partylayer/adapter-starter` builds with `tsc` (not `tsup`), so its
`index.d.ts` re-exports from sibling files rather than inlining them. Its
snapshot therefore captures only the entry file. This is a low-risk template
package; the eleven `tsup`-built packages (core, provider, react, sdk,
registry-client, and all six adapters) get full rolled-up surfaces.
