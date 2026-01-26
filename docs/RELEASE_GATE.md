# Release Gate Checklist

**Purpose:** Step-by-step manual verification before releasing CantonConnect.

**Last Updated:** 2026-01-25

---

## Pre-Release Verification

### 1. Automated Verification

```bash
# Run full verification pipeline
pnpm verify:e2e
```

**Expected:** All tests pass, report generated in `artifacts/verify/<timestamp>/`

**Check:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All conformance tests pass
- [ ] All E2E tests pass (mock mode)
- [ ] Security tests pass
- [ ] Registry signatures verified (stable + beta)
- [ ] Report generated: `VERIFY_REPORT.md`

---

### 2. Registry Verification

```bash
# Verify stable registry signature
pnpm registry:verify --channel stable --pubkey registry/keys/dev.pub

# Verify beta registry signature
pnpm registry:verify --channel beta --pubkey registry/keys/dev.pub
```

**Expected:** Both registries verify successfully

**Check:**
- [ ] Stable registry signature valid
- [ ] Beta registry signature valid
- [ ] Sequence numbers are correct
- [ ] No schema validation errors

---

### 3. Real Wallet Verification (Manual)

**Prerequisites:**
- Console wallet installed in browser
- Loop wallet installed in browser

```bash
# Run real wallet verification script
./scripts/verify/real-wallets.sh
```

**Expected:** Manual verification completes, evidence collected

**Check:**
- [ ] Console wallet detected as installed
- [ ] Console wallet connect successful
- [ ] Console wallet sign message successful
- [ ] Console wallet session restore works
- [ ] Loop wallet detected as installed
- [ ] Loop wallet connect successful
- [ ] Loop wallet sign message successful
- [ ] Loop wallet shows "reconnect required" (restore limitation)
- [ ] Evidence file generated: `MANUAL_REAL_WALLETS.md`

---

### 4. Change Log Sanity

```bash
# Check changesets
pnpm changeset status

# Review changes
cat .changeset/*.md
```

**Check:**
- [ ] All changes have changesets
- [ ] Version bumps are correct
- [ ] Breaking changes documented
- [ ] Change descriptions are clear

---

### 5. Package Publish Dry-Run

```bash
# Dry-run publish (no actual publish)
pnpm changeset version --dry-run
pnpm build
```

**Check:**
- [ ] Version numbers updated correctly
- [ ] All packages build successfully
- [ ] No TypeScript errors
- [ ] No lint errors

---

### 6. Registry Rollback Drill

**Purpose:** Verify rollback procedure works

```bash
# 1. Backup current registry
cp registry/v1/stable/registry.json registry/v1/stable/registry.json.backup
cp registry/v1/stable/registry.sig registry/v1/stable/registry.sig.backup

# 2. Create "bad" registry (lower sequence)
node scripts/fixtures/downgrade.js \
  registry/v1/stable/registry.json.backup \
  registry/v1/stable/registry.json \
  1

# 3. Verify client rejects downgrade
pnpm --filter @cantonconnect/registry-client test

# 4. Restore backup
mv registry/v1/stable/registry.json.backup registry/v1/stable/registry.json
mv registry/v1/stable/registry.sig.backup registry/v1/stable/registry.sig
```

**Check:**
- [ ] Downgrade is rejected
- [ ] Client falls back to cached LKG
- [ ] Rollback procedure documented

---

### 7. Key Rotation Drill

**Purpose:** Verify key rotation procedure works

```bash
# 1. Generate new key pair
# (Use your key generation tool)

# 2. Add new public key to registry client config
# Edit: packages/registry-client/src/client.ts
# Add new key to publicKeys array

# 3. Sign registry with new key
pnpm registry:sign --channel stable --privkey registry/keys/new.pem

# 4. Verify registry with new key
pnpm registry:verify --channel stable --pubkey registry/keys/new.pub

# 5. Test client accepts either key
pnpm --filter @cantonconnect/registry-client test
```

**Check:**
- [ ] New key signs successfully
- [ ] Registry verifies with new key
- [ ] Client accepts registry signed with new key
- [ ] Old key still works (during transition)
- [ ] Key rotation procedure documented

---

### 8. Browser Compatibility

**Test in:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Check:**
- [ ] Demo app loads
- [ ] Wallet modal opens
- [ ] Connect flow works
- [ ] Sign message works
- [ ] No console errors

---

### 9. Mobile Deep Link Simulation

**Test:**
- [ ] Cantor8 deep link format correct
- [ ] Callback handling works
- [ ] State validation enforced
- [ ] Origin validation enforced

**Note:** Full mobile testing requires actual mobile device with Cantor8 installed.

---

### 10. Documentation Review

**Check:**
- [ ] README.md updated
- [ ] API docs up to date
- [ ] Wallet provider guide accurate
- [ ] Security checklist complete
- [ ] Verification matrix complete
- [ ] Release notes prepared

---

## Release Steps

### Step 1: Version Packages

```bash
pnpm changeset version
```

**Check:**
- [ ] Version numbers updated
- [ ] Changelog generated

### Step 2: Build

```bash
pnpm build
```

**Check:**
- [ ] All packages build successfully
- [ ] No errors

### Step 3: Test

```bash
pnpm verify:e2e
```

**Check:**
- [ ] All tests pass

### Step 4: Publish

```bash
pnpm changeset publish
```

**Check:**
- [ ] Packages published to npm
- [ ] Versions correct on npm

### Step 5: Update Registry

```bash
# Sign and publish registry updates
pnpm registry:sign --channel stable
# (Deploy registry files to CDN)
```

**Check:**
- [ ] Registry files deployed
- [ ] Signatures valid
- [ ] CDN serving correctly

### Step 6: Announce

- [ ] Release notes published
- [ ] Team notified
- [ ] Documentation updated

---

## Rollback Procedure

If release fails:

1. **Stop publish:** If caught early, stop npm publish
2. **Revert registry:** Restore previous registry files
3. **Revert code:** `git revert <commit>`
4. **Communicate:** Notify team of rollback

---

## Emergency Contacts

- **Registry Issues:** [Contact]
- **Security Issues:** [Contact]
- **Build Issues:** [Contact]

---

## Definition of Done

- [ ] All automated tests pass
- [ ] Registry signatures verified
- [ ] Real wallet verification completed (if applicable)
- [ ] Change log reviewed
- [ ] Package publish dry-run successful
- [ ] Rollback drill completed
- [ ] Key rotation drill completed (if applicable)
- [ ] Browser compatibility verified
- [ ] Documentation reviewed
- [ ] Release steps executed
- [ ] Registry updated
- [ ] Release announced

**Only proceed with release when ALL items are checked.**
