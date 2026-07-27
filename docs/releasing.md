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

## Post-Release

- [ ] Verify packages published to npm
- [ ] Update demo app if needed
- [ ] Announce release (if major/minor)
