# Phase 4: Production Registry System - Complete Implementation

## ✅ All Components Implemented

### D) Registry Server + Admin CLI ✅
- ✅ Created `apps/registry-server` - Minimal Express server with ETag support
- ✅ Created `packages/registry-cli` - Full CLI tool with all commands
- ✅ All CLI commands implemented:
  - `init` - Initialize registry structure
  - `add-wallet` - Add wallet with validation
  - `update-wallet` - Update wallet fields
  - `remove-wallet` - Remove wallet
  - `bump-sequence` - Increment sequence
  - `sign` - Sign registry (reuses sign script logic)
  - `verify` - Verify signature (reuses verify script logic)
  - `promote` - Promote beta → stable
  - `print-status` - Print registry status

### E) React UI Updates ✅
- ✅ Added `useRegistryStatus()` hook
- ✅ Updated WalletModal with registry status badges (channel, verified, source, stale)
- ✅ Updated debug page with full registry status JSON and refresh button

### F) Release/DX ✅
- ✅ Added Changesets configuration
- ✅ Updated CI workflow with registry verification gates
- ✅ Created `docs/releasing.md` - Release process guide
- ✅ Created `docs/registry-ops.md` - Registry operations guide

## File-by-File Changes

### New Files Created

**Registry Server:**
- `apps/registry-server/package.json`
- `apps/registry-server/tsconfig.json`
- `apps/registry-server/src/index.ts`
- `apps/registry-server/README.md`

**Registry CLI:**
- `packages/registry-cli/package.json`
- `packages/registry-cli/tsconfig.json`
- `packages/registry-cli/src/index.ts`
- `packages/registry-cli/src/registry.ts`
- `packages/registry-cli/src/sign.ts`
- `packages/registry-cli/src/verify.ts`

**Documentation:**
- `.changeset/config.json`
- `docs/releasing.md`
- `docs/registry-ops.md`

### Modified Files

- `package.json` - Added changeset scripts, express dependency
- `.github/workflows/ci.yml` - Added registry verification step
- `packages/react/src/hooks.ts` - Added useRegistryStatus hook
- `packages/react/src/modal.tsx` - Added registry status UI
- `packages/react/src/index.ts` - Export RegistryStatus type
- `packages/react/package.json` - Added registry-client dependency
- `packages/sdk/src/client.ts` - Exposed registryClient as public
- `packages/sdk/src/index.ts` - Export RegistryStatus type
- `apps/demo/src/app/debug/page.tsx` - Enhanced registry status display

## Verification Commands

### 1. Build All Packages
```bash
pnpm build
```

### 2. Start Registry Server
```bash
cd apps/registry-server
pnpm dev
# Server runs on http://localhost:3001
```

### 3. Test CLI Commands
```bash
# Build CLI
cd packages/registry-cli
pnpm build

# Print status
node dist/index.js print-status --channel stable

# Add wallet (if needed)
node dist/index.js add-wallet \
  --channel beta \
  --walletId testwallet \
  --name "Test Wallet" \
  --adapterPackage "@cantonconnect/adapter-test" \
  --sign \
  --key ../../registry/keys/dev.key

# Verify signature
node dist/index.js verify --channel beta --pubkey ../../registry/keys/dev.pub
```

### 4. Test End-to-End Flow

```bash
# Terminal 1: Start registry server
cd apps/registry-server
pnpm dev

# Terminal 2: Update demo to use local registry
# Edit apps/demo/src/app/page.tsx:
#   registryUrl: 'http://localhost:3001'

# Terminal 3: Run demo
pnpm --filter demo dev
```

### 5. Test Offline Mode

1. Open demo app in browser
2. Open DevTools → Network tab
3. Enable "Offline" mode
4. Verify:
   - WalletModal shows "Cached" or "Stale" indicator
   - Debug page shows `source: "cache"`
   - Wallets still load from cache

### 6. Test Tamper Detection

```bash
# Tamper registry
echo '{"tampered": true}' >> registry/v1/stable/registry.json

# Verify signature fails
pnpm registry:verify --channel stable --pubkey registry/keys/dev.pub
# Expected: ❌ Verification failed

# SDK should fall back to cached version
# Check debug page - should show verified:false and error
```

## Operational Runbook: Update Registry Safely

See `docs/registry-ops.md` for complete guide. Quick reference:

### Add Wallet to Beta (Staged Rollout)

```bash
# 1. Add wallet
cantonconnect-registry add-wallet \
  --channel beta \
  --walletId mywallet \
  --name "My Wallet" \
  --adapterPackage "@cantonconnect/adapter-mywallet" \
  --sign \
  --key registry/keys/dev.key

# 2. Verify
cantonconnect-registry verify --channel beta --pubkey registry/keys/dev.pub

# 3. Check status
cantonconnect-registry print-status --channel beta
```

### Promote Beta → Stable

```bash
cantonconnect-registry promote \
  --from beta \
  --to stable \
  --key registry/keys/dev.key

# Verify stable
cantonconnect-registry verify --channel stable --pubkey registry/keys/dev.pub
```

## Known Limitations

1. **Key Fingerprint**: Uses placeholder 'dev-key' if public key not found alongside private key. Store public keys with private keys or derive properly.

2. **Public Key Derivation**: Ed25519 public key derivation from PKCS8 private key not fully implemented. Store public keys separately.

3. **Registry Server**: Basic implementation - may need CORS config, rate limiting for production.

4. **CLI Error Messages**: Some edge cases may need better error messages.

5. **Changesets**: Requires manual creation - consider automating for common changes.

## CI Gates

The CI workflow now:
- ✅ Runs lint, typecheck, build, test
- ✅ Verifies stable registry signature (if exists)
- ✅ Verifies beta registry signature (if exists)
- ✅ Fails CI if verification fails

## Next Steps

1. Generate dev keys: `pnpm registry:sign --generate-key`
2. Sign sample registries: `pnpm registry:sign --channel stable --key registry/keys/dev.key`
3. Test end-to-end flow with registry server
4. Deploy registry server to production
5. Set up production signing keys (separate from dev keys)
