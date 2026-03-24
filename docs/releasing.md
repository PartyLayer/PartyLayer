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

## Registry Updates

Registry updates are separate from package releases. See [Registry Operations](./registry-ops.md).

## Pre-Release Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Registry signatures verified (`pnpm registry:verify`)
- [ ] Changesets created for all changes
- [ ] CHANGELOG.md reviewed
- [ ] Documentation updated if needed

## Post-Release

- [ ] Verify packages published to npm
- [ ] Update demo app if needed
- [ ] Announce release (if major/minor)
