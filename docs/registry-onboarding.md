# Registry Onboarding Guide

**How to get your wallet listed in the CantonConnect registry**

## Overview

The CantonConnect wallet registry is a signed, versioned JSON file that lists available wallets. Wallets start in the `beta` channel and are promoted to `stable` after validation.

## Required Registry Fields

### Basic Fields

```json
{
  "walletId": "mywallet",
  "name": "My Wallet",
  "description": "A wallet for Canton Network",
  "website": "https://mywallet.com",
  "icons": {
    "sm": "https://mywallet.com/icon-sm.png",
    "md": "https://mywallet.com/icon-md.png",
    "lg": "https://mywallet.com/icon-lg.png"
  },
  "category": "mobile", // or "browser", "enterprise"
  "channel": "beta", // or "stable"
  "capabilities": ["connect", "disconnect", "signMessage"],
  "adapter": {
    "packageName": "@mywallet/adapter",
    "versionRange": "^1.0.0"
  },
  "docs": ["https://docs.mywallet.com"],
  "networks": ["devnet", "testnet", "mainnet"]
}
```

### Install Hints

Provide hints for wallet detection:

#### Browser Extension

```json
{
  "installHints": {
    "injectedKey": "myWallet", // window.myWallet
    "extensionId": "abcdefghijklmnopqrstuvwxyz123456" // Chrome extension ID
  }
}
```

#### Mobile Wallet (Deep Link)

```json
{
  "installHints": {
    "deepLinkScheme": "mywallet", // mywallet://
    "universalLinkBase": "https://app.mywallet.com"
  }
}
```

#### Remote Signer

```json
{
  "installHints": {
    // No install hints needed for remote signers
  },
  "category": "enterprise"
}
```

### Origin Allowlist

If your wallet supports origin allowlist:

```json
{
  "originAllowlist": [
    "https://myapp.com",
    "https://*.myapp.com" // Wildcard support
  ]
}
```

**Note**: SDK automatically enforces origin allowlist if provided.

## Workflow: Beta → Stable

### Step 1: Add to Beta Registry

```bash
cantonconnect-registry add-wallet \
  --channel beta \
  --walletId mywallet \
  --name "My Wallet" \
  --description "A wallet for Canton Network" \
  --website "https://mywallet.com" \
  --adapterPackage "@mywallet/adapter" \
  --adapterRange "^1.0.0" \
  --capabilities connect,disconnect,signMessage \
  --installHints '{"injectedKey":"myWallet"}' \
  --docs '["https://docs.mywallet.com"]' \
  --networks devnet,testnet,mainnet
```

### Step 2: Run Conformance Tests

```bash
# Build adapter
cd packages/adapters/mywallet
pnpm build

# Run conformance
cantonconnect-conformance run --adapter ./dist

# Verify all tests pass
```

### Step 3: Sign Registry

```bash
cantonconnect-registry sign \
  --channel beta \
  --key ./registry/keys/dev-private.pem
```

### Step 4: Verify Registry

```bash
cantonconnect-registry verify \
  --channel beta \
  --pubkey ./registry/keys/dev-public.pem
```

### Step 5: Promote to Stable

After beta testing period:

```bash
cantonconnect-registry promote \
  --from beta \
  --to stable \
  --key ./registry/keys/dev-private.pem
```

## Key Rotation

### Adding a New Key

1. Generate new key pair:
   ```bash
   # Generate Ed25519 key pair
   openssl genpkey -algorithm Ed25519 -out new-private.pem
   openssl pkey -pubout -in new-private.pem -out new-public.pem
   ```

2. Add public key to SDK config:
   ```typescript
   const client = createCantonConnect({
     registryPublicKeys: [
       'old-public-key-base64',
       'new-public-key-base64', // Add new key
     ],
   });
   ```

3. Sign registry with new key:
   ```bash
   cantonconnect-registry sign --channel stable --key new-private.pem
   ```

4. After transition period, remove old key from config.

## Rollback Procedure

If a bad registry is published:

1. **Identify last-known-good sequence**:
   ```bash
   cantonconnect-registry print-status --channel stable
   ```

2. **Restore from cache** (SDK automatically uses last-known-good)

3. **Fix registry** and publish with higher sequence:
   ```bash
   cantonconnect-registry bump-sequence --channel stable
   cantonconnect-registry sign --channel stable --key private.pem
   ```

## Required Fields Checklist

- [ ] `walletId` - Unique identifier
- [ ] `name` - Display name
- [ ] `description` - Brief description
- [ ] `website` - Wallet website
- [ ] `icons` - At least one icon URL
- [ ] `category` - mobile, browser, or enterprise
- [ ] `channel` - beta or stable
- [ ] `capabilities` - Array of supported capabilities
- [ ] `adapter.packageName` - NPM package name
- [ ] `adapter.versionRange` - Semantic version range
- [ ] `docs` - Array of documentation URLs
- [ ] `networks` - Supported networks
- [ ] `installHints` - Detection hints (if applicable)

## Security Considerations

- **Origin Allowlist**: Use for production wallets to restrict access
- **Version Range**: Use semantic versioning (e.g., `^1.0.0`)
- **Signature Verification**: Always verify registry signatures
- **Sequence Numbers**: Never decrease sequence (prevents downgrade attacks)

## Support

- Registry CLI: `cantonconnect-registry --help`
- Security: security@cantonconnect.io
