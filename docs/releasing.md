# Release Process

This document describes how to cut releases and publish packages for PartyLayer.

## Versioning Strategy

We follow [Semantic Versioning](https://semver.org/):

- **Patch** (x.x.1): Bug fixes, internal refactoring, non-breaking changes
- **Minor** (x.1.0): New features, backward-compatible API additions
- **Major** (1.0.0): Breaking changes to public API

### What Constitutes a Breaking Change?

- Removing or renaming public API methods/types
- Changing method signatures (parameters, return types)
- Removing exported types/constants
- Changing error codes or error behavior
- Removing adapter capabilities

### What Does NOT Constitute a Breaking Change?

- Adding new methods/types to public API
- Adding optional parameters
- Internal refactoring
- Bug fixes that restore intended behavior
- Registry schema updates (registry is versioned separately)

## Release Workflow

### 1. Create Changeset

When making changes that affect packages:

```bash
pnpm changeset
```

This will:
- Prompt you to select affected packages
- Ask for change type (patch/minor/major)
- Create a changeset file in `.changeset/`

> **Enforced by the gate.** `pnpm gate:release-changeset` fails when a publishable
> package's shipping content (its `src/`, a shipped `files` directory such as
> `create-partylayer-app/templates`, or a consumer-facing `package.json` field) changed
> since its last release tag but no changeset covers it. This is what stops a fix from
> merging and then never shipping. If a change genuinely needs no release (a revert, a
> moved comment), record that with an empty changeset, `pnpm changeset --empty`, rather
> than inventing a version bump. See [scripts/gate/README.md](../scripts/gate/README.md).

### 2. Update Changeset Files

Edit the generated changeset file to add a clear description:

```markdown
---
"@partylayer/sdk": patch
---

Fixed session restoration bug when wallet adapter doesn't support restore
```

### 3. Version Packages

When ready to release:

```bash
pnpm version-packages
```

This:
- Updates package.json versions based on changesets
- Generates CHANGELOG.md entries
- Removes used changeset files

### 4. Commit and Push

```bash
git add .
git commit -m "chore: version packages"
git push
```

### 5. Create Release PR

Create a PR with the version bump. After review and merge:

### 6. Publish Packages

```bash
pnpm release
```

This builds all packages and publishes to npm (requires authentication).

> **Important:** Always use `pnpm release`, never `npm run release` or `yarn release`.
> pnpm automatically resolves `workspace:*` dependencies to their actual semver versions
> at publish time. Using npm or yarn will publish unresolved `workspace:*` references,
> which causes `EUNSUPPORTEDPROTOCOL` errors for consumers.

> **Verified (@changesets/cli 2.29.8):** `pnpm release` runs `changeset publish`, which
> detects the package manager and, when pnpm is detected, spawns `pnpm publish` per package
> rather than `npm publish`. `pnpm publish` expands `workspace:^` and similar ranges to real
> semver in the published manifest, so this flow does not reproduce the 2.2.0 unresolved
> range defect. This holds as long as pnpm is the package manager changesets detects; if it
> ever ran somewhere pnpm was not on PATH, changesets would fall back to `npm publish`, which
> does not expand workspace ranges. Evidence: `internalPublish` in
> `node_modules/@changesets/cli/dist/changesets-cli.cjs.js` spawns `pnpm publish` when the
> detected tool is pnpm, with the package directory as the cwd.

## Process notes

Pull requests always target `main`. If a change depends on work that is not merged yet,
merge that first and then branch from `main`, rather than stacking one feature branch on
another. A stacked pull request can be closed or silently absorbed when its base branch
lands, so the change never reaches `main` even though the pull request badge shows as
merged. Keeping the base as `main` also ensures CI runs on the pull request.

For the same reason, before merging a pull request when `main` has moved since the branch
was cut, confirm the branch is current with `main`. A branch cut before another change
landed still carries the pre-change tree, so merging it silently reverts whatever landed in
between; because the reverted files can keep the same names, nobody notices until the old
behaviour reappears (a wallet mark reverting to the wrong icon is one way this shows up).
Rebase the branch onto `main`, then confirm the diff touches only the files the pull request
is meant to change. This is the same failure shape as a stacked pull request, arriving
through a different door.

## Registry Updates

Registry updates are separate from package releases. See [Registry Operations](./registry-ops.md).

## Scaffold Templates

The `create-partylayer-app` templates (in `packages/create-partylayer-app/templates/*`)
pin the `@partylayer/*` versions a scaffolded app installs. A major bump (or, for a 0.x
package, a breaking minor) of `@partylayer/react`, `@partylayer/vue`, `@partylayer/sdk`,
`@partylayer/session`, or `@partylayer/core` MUST update the matching pins in each
template's `_package.json`, or new users scaffold a version behind. When a package gains a
new required peer (for example react v2 adding `@tanstack/react-query`), add it to the
relevant templates too.

This is enforced by `pnpm gate:templates` (part of the main gate): it fails when a
template's range cannot resolve to the current workspace version. If the gate fails after
a version bump, update the template pins in the same change.

## React Native web smoke (required before publishing @partylayer/react-native)

`@partylayer/react-native` loads its optional peers (react-native-svg, react-native
Linking, AsyncStorage) through static imports so a bundler can see them. The unit tests
inject those modules through test seams, so they CANNOT catch a reversion to
bundler-invisible loading, which fails only in a real bundle. Before publishing this
package, run the Expo demo web smoke, which bundles the ui and asserts it renders:

```bash
cd demos/expo-connect
pnpm run prepare-local && pnpm install --ignore-workspace
pnpm run web-smoke
```

It must exit 0 (wallet list opens, react-native-svg and Image renderers both work, no
uncaught page error). If it fails, the module loading regressed; do not publish.

## Local production UI acceptance

A hosting account or Vercel preview login is not required for code, package or UI
validation. From the repository root:

```bash
pnpm build
pnpm --filter partylayer-demo start --port 43173 --hostname 127.0.0.1
```

Open `http://127.0.0.1:43173/kit-demo`. Check the actual supported wallet list,
Vala's Devnet beta label, default PartyLayer attribution, search, language/RTL,
keyboard focus containment and Escape restoration, and mobile overflow. Rebuild
and restart the local server after changing production code; reload the browser
before collecting evidence. Record the commit and checks separately from the
live wallet matrix. Production UI acceptance uses the real catalog, without a
mock connected account.

Use `pnpm gate` for the automated workspace, packed-consumer and controlled
browser checks. Wallet approval and ledger tests may require an origin allowed
by the vendor; localhost UI checks do not establish that a production-origin
wallet authorization, transfer or swap works.

## Default wallet release validation

The broader product milestones and completion criteria are tracked in the
[Canton wallet platform roadmap](./platform-roadmap.md). The default catalog release
does not close those milestones. Live wallet tests, including Loop, are deferred
to the final acceptance stage at the maintainer's request.

The public catalog is tested across stable/beta and devnet/testnet/mainnet. Its
network filters and capability filters must agree with the active integration.
`pnpm gate` also packs all public packages, installs the packed React entry in a
clean npm consumer, checks ESM/CommonJS/SSR, and builds packed CLI-generated
Next.js and Vite apps. These are automated integration checks, not proof of a
successful live wallet approval or ledger commit.

The 2026-10-24 code review also adds four axe accessibility scenarios to the PR
browser suite, plus ten docs axe/reflow cases across desktop and 320 px mobile.
It rejects contradictory execution command IDs in both normalized
receipts and the native provider facade. The installed Vala runtime is covered
with controlled HTTP/popup tests. See [acceptance evidence](./wallet-acceptance.md)
for the exact scope, the outstanding VoiceOver run and actual Devnet test areas.
These checks do not complete the live matrix below.

Live observations in this review (2026-10-23, production `33898ef`; the candidate
in PR #343 has separate automated coverage and has not inherited these live results):

| Wallet | Live result in this review | Live ledger submission |
| --- | --- | --- |
| Vala | Devnet connect, message signature returned, reload/restore and disconnect passed | Pending valid vendor-provided Devnet transaction/test dApp |
| Console | Devnet connection timed out after Chrome restart; unlock/readiness check pending | Not tested |
| Cauri | Devnet connect, message signature returned, saved session redisplayed after reload, and disconnect passed | Not tested |
| Send | Test account available; Mainnet test pending | Not tested |
| 5N Loop | Devnet sign request reached wallet UI; wallet reported `Could not unlock private key`, also reproduced with the official Loop SDK alone | Not tested |
| Walley | Test account available; live test pending | Not tested |
| OneSwap | Maintainer reports prior successful use; repeat login test omitted at their request | Not retested |
| Cantor8 | Live test access not established in this review | Not tested |
| Nightly | Live test access not established in this review | Not tested |
| Bron | Enterprise test access not established in this review | Not tested |
| WalletConnect | Paired wallet/relay live test not established in this review | Not tested |

Vala's post-sign requests page reported `DAPP_API_ENABLED` disabled even though the
message signature returned to PartyLayer. This warning does not establish that
message signing failed, or that transaction submission works. Returned signature
bytes alone are not an independent cryptographic verification against the wallet's
public key. Keep Vala on Devnet beta and update these results after the remaining
tests; do not describe the full wallet matrix as live-verified.

The verification runner deliberately skips four browser-required adapter
conformance suites in CI. The native provider conformance gate and mocked browser
tests do not replace those live/extension checks. The separate extension-isolation
record remains in `apps/demo/e2e/manual-runs.json`; do not mark it passed without
running the named specs against recorded extension versions.

## Wallet SDK maintenance

`.github/dependabot.yml` checks supported wallet SDK dependencies every day at
09:00 Europe/Istanbul, including weekends. It opens update PRs and advances the
manifest minimum and pnpm lockfile together. Patch and minor updates are grouped
separately; major releases remain individual PRs. The configuration covers the
public SDK, legacy integrations and workspace lockfile, including Canton dApp SDK,
Loop, Console, Cantor8, Walley, Cauri, OneSwap, Vala and WalletConnect.

These PRs use the same build, unit, conformance, packed-consumer and browser gates
as product changes. Review changed public APIs, approved loader pins, registry
metadata and release changesets before merging. A newly published vendor version
is an update candidate; a compatible, tested version is what PartyLayer ships.

The candidate uses official discovery **1.15.0** for browser-native connections
and reviewed Canton dApp SDK **1.8.0** for the existing WalletConnect compatibility path.
Native cached sessions need one explicit reconnect when the official provider hint
is absent. Native `asProvider` Ledger API reads now return raw JSON; review
[the migration guide](./protocol-ownership.md#storage-and-api-migration) before release. Walley's
1.2.0 runtime still requires its **^0.24.0** peer, explicitly supplied as 0.24.0
by the default SDK. Keep that compatibility path isolated until the vendor changes
its contract; a blanket upgrade would introduce a peer mismatch. See
[Protocol ownership](./protocol-ownership.md) for the reviewed public APIs and
remaining migration gates. Neither version pin establishes live relay acceptance.
See the [Dependabot configuration reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

## Pre-Release Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Registry signatures verified (`pnpm registry:verify`)
- [ ] Scaffold templates up to date (`pnpm gate:templates`)
- [ ] React Native web smoke passes if `@partylayer/react-native` changed (`cd demos/expo-connect && pnpm run web-smoke`)
- [ ] Changesets created for all changes
- [ ] CHANGELOG.md reviewed
- [ ] Documentation updated if needed

## Documentation release alignment

README and installation guides state their minimum version scope: React 3.1.0,
SDK 0.20.0 and CLI 0.6.0 for this coordinated release. Confirm those versions are
available before claiming a public-registry installation passed. Recheck the same
commands against npm after publication; an `@latest` tag alone is not evidence.

Keep the homepage, site installation/quick-start pages, root/SDK/React/CLI READMEs
and generated template guides aligned. Run `pnpm gate:docs-drift`,
`pnpm gate:readme` and `pnpm gate:templates`. The wallet table is generated from
the registry plus actual SDK capabilities; use `pnpm gen:readme` instead of editing
its marked sections. Document runtime inclusion separately from wallet login,
network support, capability limits and completed live acceptance.

After changing the quick start, SDK README, registry or entry-point package versions,
run `pnpm gen:readme` first when wallet metadata changes, then `pnpm gen:ai-docs`.
Commit both generated AI references. `pnpm gate:ai-docs`, the required docs gate and
the demo production prebuild reject stale output. `llms-full.txt` includes the actual
React guide examples, which are compiled by the same snippet gate as the public site.
Do not hand-edit generated files or introduce a separate AI-only API example.

## Post-Release

- [ ] Verify packages published to npm
- [ ] Update demo app if needed
- [ ] Announce release (if major/minor)

## Public entry-guide and discovery checks

`pnpm gate:docs-drift` includes `pnpm gate:docs-snippets`, which compiles actual installation, quick-start, landing, SSR and Canton migration snippets against the public declarations. Run it after changing a public example; building the docs page alone only checks its string rendering. The browser discovery suite also checks that the playground serves useful initial HTML and still hydrates into the connection UI.

The daily public growth workflow includes bounded HTTP/canonical/robots checks for the sitemap URLs and compares both deployed AI references against the repository output. Its technical health results are separate from Search Console processing, Googlebot access, AI citations and search ranking. See the [growth roadmap](./growth/roadmap.md).
