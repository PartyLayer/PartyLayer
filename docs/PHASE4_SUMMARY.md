# Phase 4: Production Registry System - Implementation Summary

## ✅ Completed Components

### A) Signed Registry Format
- ✅ Updated schema with `channel`, `sequence`, `publishedAt`
- ✅ Signature in separate `.sig` file (Ed25519)
- ✅ Created registry directory structure
- ✅ Created `scripts/registry/sign.ts` for signing
- ✅ Created `scripts/registry/verify.ts` for verification
- ✅ Sample registry files created

### B) Registry Client Enhancements
- ✅ Complete rewrite with Ed25519 signature verification
- ✅ Multi-channel support (stable/beta)
- ✅ Sequence number validation (prevents downgrades)
- ✅ Last-known-good caching with rollback
- ✅ SWR pattern (serve cached immediately, refresh in background)
- ✅ ETag support for efficient updates
- ✅ Registry status tracking (`RegistryStatus` interface)
- ✅ Persistent storage support

### C) SDK Integration
- ✅ Added `RegistryStatusEvent` to events
- ✅ SDK client initializes registry with signature verification
- ✅ `getRegistryStatus()` method added
- ✅ Registry status events emitted automatically
- ✅ Origin allowlist enforcement in `connect()`

## 🔄 Remaining Work

### D) Registry Server + CLI
- [ ] Create minimal registry server (`apps/registry-server`)
- [ ] Create registry CLI (`packages/registry-cli`)

### E) React Components
- [ ] Update WalletModal to show registry status badges
- [ ] Update debug page to show full registry status

### F) Release/DX
- [ ] Versioning strategy documentation
- [ ] CI gates for registry verification
- [ ] Release runbook

## Key Files Created/Modified

### New Files
- `packages/registry-client/src/status.ts` - Registry status types
- `scripts/registry/sign.ts` - Signing script
- `scripts/registry/verify.ts` - Verification script
- `registry/v1/stable/registry.json` - Sample stable registry
- `registry/v1/beta/registry.json` - Sample beta registry

### Modified Files
- `packages/registry-client/src/schema.ts` - Updated with channel, sequence, originAllowlist
- `packages/registry-client/src/client.ts` - Complete rewrite with verification
- `packages/sdk/src/events.ts` - Added RegistryStatusEvent
- `packages/sdk/src/client.ts` - Added registry status tracking and origin allowlist
- `packages/core/src/types.ts` - Added metadata to WalletInfo

## Operational Runbook: Update Registry Safely

### Prerequisites
1. Generate signing key pair (dev only):
   ```bash
   pnpm registry:sign --generate-key
   ```
   This creates `registry/keys/dev-{timestamp}.pub` and `.key` files.

2. **IMPORTANT**: Never commit private keys (`.key` files) to git.
   Add `registry/keys/*.key` to `.gitignore`.

### Step-by-Step: Add Wallet to Stable Registry

1. **Edit registry JSON**:
   ```bash
   # Edit registry/v1/stable/registry.json
   # Add new wallet entry with unique ID
   # Increment sequence number in metadata
   ```

2. **Validate schema**:
   ```bash
   # Schema validation happens automatically in sign script
   ```

3. **Sign registry**:
   ```bash
   pnpm registry:sign --channel stable --key registry/keys/dev.key
   ```

4. **Verify signature**:
   ```bash
   pnpm registry:verify --channel stable --pubkey registry/keys/dev.pub
   ```

5. **Test locally**:
   ```bash
   # Update demo app to use local registry
   # Test wallet appears and connects correctly
   ```

6. **Deploy to registry server**:
   ```bash
   # Copy registry.json and registry.sig to server
   # Ensure ETag headers are configured
   ```

### Staged Rollout (Beta → Stable)

1. **Add to beta first**:
   ```bash
   # Edit registry/v1/beta/registry.json
   # Sign: pnpm registry:sign --channel beta --key registry/keys/dev.key
   ```

2. **Monitor beta usage**:
   - Check error rates
   - Verify wallet adapter works correctly
   - Monitor registry status events

3. **Promote to stable**:
   ```bash
   # Copy wallet entry from beta to stable
   # Increment stable sequence
   # Sign stable registry
   ```

### Key Rotation

1. **Generate new key pair**:
   ```bash
   pnpm registry:sign --generate-key
   ```

2. **Sign with both keys** (during transition):
   ```bash
   # Sign with old key
   pnpm registry:sign --channel stable --key registry/keys/old.key
   
   # Sign with new key (overwrites signature)
   pnpm registry:sign --channel stable --key registry/keys/new.key
   ```

3. **Update SDK configs**:
   - Add new public key to `registryPublicKeys` array
   - Keep old key for backward compatibility

4. **After transition period**:
   - Remove old key from `registryPublicKeys`
   - Archive old private key securely

### Rollback Procedure

If a bad registry is published:

1. **Identify last known good sequence**:
   ```bash
   # Check cached registry in SDK
   # Note the sequence number
   ```

2. **Restore previous registry**:
   ```bash
   # Copy previous registry.json
   # Ensure sequence is higher than bad one
   # Sign and publish
   ```

3. **SDK automatically uses cached version**:
   - SDK detects sequence downgrade and rejects
   - Falls back to last-known-good cache
   - Emits `REGISTRY_VERIFICATION_FAILED` error event

## Verification Commands

```bash
# Build all packages
pnpm build

# Verify registry signatures
pnpm registry:verify --channel stable --pubkey registry/keys/dev.pub
pnpm registry:verify --channel beta --pubkey registry/keys/dev.pub

# Test offline mode (simulate network failure)
# In demo app, block network requests
# Verify SDK uses cached registry and shows stale indicator

# Test tamper detection
# Modify registry.json locally
# Verify signature verification fails
# Verify SDK falls back to last-known-good
```

## Security Features

1. **Signature Verification**: Ed25519 signatures prevent tampering
2. **Sequence Validation**: Prevents downgrade attacks
3. **Origin Allowlist**: Wallets can restrict which origins can connect
4. **Last-Known-Good**: Falls back to verified cache on verification failure
5. **ETag Support**: Efficient updates without re-downloading unchanged registries

## Next Steps

1. Create registry server (simple static file server)
2. Create registry CLI for managing registries
3. Update React components to show registry status
4. Add CI gates for registry verification
5. Create comprehensive release documentation
