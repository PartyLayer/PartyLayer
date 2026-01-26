# Registry Operations Guide

This guide covers how to safely update, promote, and rollback the wallet registry.

## Prerequisites

1. **Signing Keys**: Generate keys using:
   ```bash
   pnpm registry:sign --generate-key
   ```
   ⚠️ **Never commit private keys (`.key` files) to git.**

2. **Registry CLI**: Install and build:
   ```bash
   cd packages/registry-cli
   pnpm install
   pnpm build
   ```

## Common Operations

### Add a New Wallet

```bash
# Add to beta first (staged rollout)
cantonconnect-registry add-wallet \
  --channel beta \
  --walletId mywallet \
  --name "My Wallet" \
  --adapterPackage "@cantonconnect/adapter-mywallet" \
  --adapterRange ">=0.1.0" \
  --homepage "https://mywallet.com" \
  --icon "https://mywallet.com/icon.png" \
  --sign \
  --key registry/keys/dev.key

# Verify
cantonconnect-registry verify --channel beta --pubkey registry/keys/dev.pub

# Check status
cantonconnect-registry print-status --channel beta
```

### Promote from Beta to Stable

```bash
# Promote beta registry to stable
cantonconnect-registry promote \
  --from beta \
  --to stable \
  --key registry/keys/dev.key

# Verify stable
cantonconnect-registry verify --channel stable --pubkey registry/keys/dev.pub
```

### Update Existing Wallet

```bash
cantonconnect-registry update-wallet \
  --channel stable \
  --walletId mywallet \
  --name "Updated Wallet Name" \
  --homepage "https://newurl.com"

# Sign after update
cantonconnect-registry sign --channel stable --key registry/keys/dev.key
```

### Remove Wallet

```bash
cantonconnect-registry remove-wallet \
  --channel stable \
  --walletId deprecated-wallet

# Sign after removal
cantonconnect-registry sign --channel stable --key registry/keys/dev.key
```

### Bump Sequence (Force Refresh)

```bash
# Increment sequence without changing wallets
cantonconnect-registry bump-sequence --channel stable

# Sign
cantonconnect-registry sign --channel stable --key registry/keys/dev.pub
```

## Key Rotation

### 1. Generate New Key Pair

```bash
pnpm registry:sign --generate-key
# Creates registry/keys/dev-{timestamp}.pub and .key
```

### 2. Sign with Both Keys (Transition Period)

```bash
# Sign with old key
cantonconnect-registry sign --channel stable --key registry/keys/old.key

# Sign with new key (overwrites)
cantonconnect-registry sign --channel stable --key registry/keys/new.key
```

### 3. Update SDK Configs

Add new public key to `registryPublicKeys` array:

```typescript
const client = createCantonConnect({
  registryPublicKeys: [
    'old-public-key-base64', // Keep for backward compatibility
    'new-public-key-base64', // Add new key
  ],
  // ...
});
```

### 4. After Transition Period

- Remove old key from `registryPublicKeys`
- Archive old private key securely
- Update documentation

## Rollback Procedure

If a bad registry is published:

### 1. Identify Last Known Good Sequence

Check cached registry in SDK or check git history:

```bash
git log registry/v1/stable/registry.json
```

### 2. Restore Previous Registry

```bash
# Checkout previous version
git checkout HEAD~1 -- registry/v1/stable/registry.json

# Ensure sequence is higher than bad one
# Edit metadata.sequence if needed

# Sign with current key
cantonconnect-registry sign --channel stable --key registry/keys/dev.key

# Verify
cantonconnect-registry verify --channel stable --pubkey registry/keys/dev.pub
```

### 3. SDK Behavior

- SDK detects sequence downgrade and rejects new registry
- Falls back to last-known-good cache
- Emits `REGISTRY_VERIFICATION_FAILED` error event
- UI shows cached/stale indicator

## Staged Rollout Workflow

1. **Add to Beta**:
   ```bash
   cantonconnect-registry add-wallet --channel beta ...
   ```

2. **Monitor Beta Usage**:
   - Check error rates
   - Verify wallet adapter works
   - Monitor registry status events in debug page

3. **Promote to Stable**:
   ```bash
   cantonconnect-registry promote --from beta --to stable --key ...
   ```

4. **Monitor Stable**:
   - Watch for errors
   - Verify signature verification works
   - Check cache behavior

## Registry Server Deployment

### Development

```bash
cd apps/registry-server
pnpm dev
```

### Production

```bash
# Set environment variables
export PORT=3001
export REGISTRY_DIR=/path/to/registry

# Run server
pnpm start
```

### Static Hosting (Vercel/Netlify)

```bash
DEPLOY_MODE=static pnpm start
```

This prints file locations to serve via CDN.

## Security Best Practices

1. **Never commit private keys** - Add `registry/keys/*.key` to `.gitignore`
2. **Use separate keys for dev/prod** - Never use dev keys in production
3. **Rotate keys periodically** - Follow key rotation procedure
4. **Verify signatures before deploying** - Always run `verify` command
5. **Monitor sequence numbers** - Ensure monotonic increments
6. **Test rollback procedure** - Know how to recover from bad updates

## Troubleshooting

### Signature Verification Fails

- Check public key matches private key used to sign
- Verify registry.json wasn't modified after signing
- Ensure signature file exists and is valid JSON

### Sequence Downgrade Detected

- This is intentional security feature
- SDK rejects downgrades and uses cached version
- To fix: ensure new registry has higher sequence number

### Registry Not Updating

- Check ETag headers - SDK uses 304 Not Modified
- Clear SDK cache: `client.clearCache()` (if exposed)
- Verify registry server is serving latest files

## See Also

- [Phase 4 Summary](./PHASE4_SUMMARY.md) - Operational runbook
- [Release Process](./releasing.md) - Package versioning and publishing
