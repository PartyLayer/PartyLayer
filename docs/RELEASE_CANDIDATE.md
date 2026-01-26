# Release Candidate Checklist

This checklist ensures all components are production-ready before cutting a release.

## Pre-Release Verification

### 1. Package Build & Test ✅

- [ ] All packages build successfully: `pnpm build`
- [ ] All tests pass: `pnpm test`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

**Commands:**
```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

### 2. Registry Verification ✅

- [ ] Stable registry signature verified: `pnpm registry:verify --channel stable --pubkey registry/keys/dev.pub`
- [ ] Beta registry signature verified: `pnpm registry:verify --channel beta --pubkey registry/keys/dev.pub`
- [ ] Registry sequence numbers are monotonic
- [ ] No duplicate wallet IDs in registry

**Commands:**
```bash
pnpm registry:verify --channel stable --pubkey registry/keys/dev.pub
pnpm registry:verify --channel beta --pubkey registry/keys/dev.pub
```

### 3. Demo App ✅

- [ ] Demo builds successfully: `cd apps/demo && pnpm build`
- [ ] Demo dev server starts: `cd apps/demo && pnpm dev`
- [ ] E2E smoke tests pass: `cd apps/demo && pnpm test:e2e`
- [ ] No console errors in browser
- [ ] Registry status displays correctly
- [ ] Connect modal opens and shows wallets

**Commands:**
```bash
cd apps/demo
pnpm build
pnpm dev  # Test manually in browser
pnpm test:e2e
```

### 4. CI Gates ✅

- [ ] All CI checks pass on main branch
- [ ] Registry verification step passes
- [ ] Demo build step passes
- [ ] E2E tests pass in CI

**Check:** GitHub Actions workflow status

## Versioning Steps

### 1. Create Changesets

For each change that affects packages:

```bash
pnpm changeset
```

Select:
- Affected packages
- Change type (patch/minor/major)
- Description

### 2. Review Changesets

Review `.changeset/*.md` files to ensure:
- Descriptions are clear
- Change types are appropriate
- All breaking changes are marked as major

### 3. Version Packages

```bash
pnpm version-packages
```

This will:
- Update package.json versions
- Generate CHANGELOG.md entries
- Remove used changeset files

### 4. Review Version Bumps

Check `CHANGELOG.md` and package.json files:
- Versions incremented correctly
- Changelog entries are accurate
- No unintended version bumps

## Publishing Steps

### 1. Dry Run

Test publishing without actually publishing:

```bash
pnpm release --dry-run
```

Verify:
- Correct packages are published
- Version numbers are correct
- No private packages are published

### 2. Authenticate

Ensure you're authenticated with npm:

```bash
npm whoami
```

If not authenticated:
```bash
npm login
```

### 3. Publish

```bash
pnpm release
```

This publishes all packages with version bumps.

### 4. Verify Publication

Check npm:
- Packages appear on npmjs.com
- Versions match expected versions
- README and package.json are correct

## Registry Update (If Needed)

If registry needs updating:

1. **Add to Beta** (staged rollout):
   ```bash
   cantonconnect-registry add-wallet \
     --channel beta \
     --walletId newwallet \
     --name "New Wallet" \
     --adapterPackage "@cantonconnect/adapter-newwallet" \
     --sign \
     --key registry/keys/prod.key
   ```

2. **Verify Beta**:
   ```bash
   cantonconnect-registry verify --channel beta --pubkey registry/keys/prod.pub
   ```

3. **Promote to Stable** (after testing):
   ```bash
   cantonconnect-registry promote \
     --from beta \
     --to stable \
     --key registry/keys/prod.key
   ```

4. **Deploy Registry**:
   - Update registry server files
   - Verify CDN/hosting serves new files
   - Check ETag headers work

## Rollback Plan

### Package Rollback

If a bad package is published:

1. **Immediate**: Unpublish (within 72 hours):
   ```bash
   npm unpublish @cantonconnect/sdk@1.2.3
   ```

2. **After 72 hours**: Publish patch version with fix

### Registry Rollback

If bad registry is published:

1. **Identify last known good sequence**:
   ```bash
   git log registry/v1/stable/registry.json
   ```

2. **Restore previous registry**:
   ```bash
   git checkout HEAD~1 -- registry/v1/stable/registry.json
   # Edit sequence if needed
   cantonconnect-registry sign --channel stable --key registry/keys/prod.key
   ```

3. **Deploy rollback**:
   - Update registry server
   - SDK will detect sequence downgrade and reject
   - SDK falls back to cached version

## Post-Release

- [ ] Announce release (if major/minor)
- [ ] Update demo app if needed
- [ ] Monitor error rates
- [ ] Check registry status in production
- [ ] Verify SDK downloads from npm

## Emergency Contacts

- **Registry Issues**: [Contact registry maintainer]
- **SDK Issues**: [Contact SDK maintainer]
- **Security Issues**: [Contact security team]

## Release Notes Template

```markdown
# Release v1.2.3

## Changes

- Feature: Added X
- Fix: Fixed Y
- Breaking: Changed Z (see migration guide)

## Registry Updates

- Added Wallet A to stable channel
- Updated Wallet B metadata

## Migration Guide

[If breaking changes]
```
