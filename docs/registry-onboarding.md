# Registry Onboarding Guide

**How to get your wallet listed in the PartyLayer registry**

## Overview

The PartyLayer wallet registry is a signed, versioned JSON file that lists available wallets. Wallets start in the `beta` channel and are promoted to `stable` after validation. Each wallet is one entry in the `wallets` array of `registry/v1/<channel>/registry.json`, and every entry must match the `RegistryWalletEntry` schema in `packages/registry-client/src/schema.ts` (also enforced by `tooling/registry-schema/registry.schema.json`).

## Registry Entry Schema

### Required fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Wallet identifier, unique within the channel |
| `name` | `string` | Display name shown in the picker |
| `supportedNetworks` | `NetworkId[]` | e.g. `["devnet", "testnet", "mainnet"]` |
| `capabilities` | object | All six boolean flags below are required |
| `adapter.type` | `string` | Adapter package name, or a logical type for announce/discovery wallets |

The `capabilities` object requires these booleans: `signMessage`, `signTransaction`, `submitTransaction`, `transactionStatus`, `switchNetwork`, `multiParty`. Optional booleans: `mobileConnect`, `remoteSigner`, and `events` (set `events: true` for wallets that emit CIP-0103 provider events).

### Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `description` | `string` | Short description |
| `homepage` | `string` | Wallet website URL |
| `icon` | `string` | Single icon URL (not an object) |
| `adapter.transport` | `'injected' \| 'announce' \| 'discovery-adapter'` | How the SDK obtains the provider (see below) |
| `adapter.config` | object | Adapter-specific configuration |
| `adapter.networkHosts` | object | Network to host mapping for `transport: 'discovery-adapter'` |
| `installation` | object | Detection hints: `windowProperty`, `scriptTag`, `extensionId`, `deeplink`, `oauth` |
| `providerDetection` | object | Match the injected `window.canton` provider to this entry |
| `cip0103` | object | `{ native: boolean, evidence?: string, since?: string }` |
| `originAllowlist` | `string[]` | Restrict which dApp origins may connect |
| `sdkVersion` | `string` | Adapter version range, e.g. `>=0.2.5` |

### Example: injected, CIP-0103 native wallet

```json
{
  "id": "mywallet",
  "name": "My Wallet",
  "description": "A wallet for Canton Network",
  "homepage": "https://mywallet.com",
  "icon": "https://mywallet.com/icon.svg",
  "supportedNetworks": ["devnet", "testnet", "mainnet"],
  "capabilities": {
    "signMessage": true,
    "signTransaction": true,
    "submitTransaction": true,
    "transactionStatus": true,
    "switchNetwork": false,
    "multiParty": false
  },
  "adapter": {
    "type": "@mywallet/adapter"
  },
  "installation": {
    "windowProperty": "myWallet",
    "extensionId": "abcdefghijklmnopqrstuvwxyz123456"
  },
  "providerDetection": {
    "transport": "window.canton",
    "matchers": [
      { "field": "provider.id", "match": "exact", "values": ["abcdefghijklmnopqrstuvwxyz123456"] }
    ]
  },
  "cip0103": {
    "native": true,
    "evidence": "https://www.npmjs.com/package/@mywallet/dapp-sdk",
    "since": "2025-11-01"
  }
}
```

### Example: announce (adapterless CIP-0103) wallet

CIP-0103 wallets that announce themselves over `canton:announceProvider` do not need a bespoke adapter package. Set `adapter.transport: "announce"` and use `adapter.config` to enable optional capabilities. See the [Generic Bridge guide](./generic-bridge.md).

```json
{
  "id": "mywallet",
  "name": "My Wallet",
  "homepage": "https://mywallet.com",
  "icon": "https://mywallet.com/icon.svg",
  "supportedNetworks": ["mainnet"],
  "capabilities": {
    "signMessage": true,
    "signTransaction": false,
    "submitTransaction": true,
    "transactionStatus": true,
    "switchNetwork": false,
    "multiParty": false,
    "events": true
  },
  "adapter": {
    "type": "@mywallet/adapter",
    "transport": "announce",
    "config": {
      "restore": true,
      "ledgerApi": true
    }
  },
  "cip0103": {
    "native": true
  }
}
```

### Origin Allowlist

If your wallet restricts which dApp origins may connect, list them. The SDK enforces the allowlist when present.

```json
{
  "originAllowlist": [
    "https://myapp.com",
    "https://*.myapp.com"
  ]
}
```

## Workflow: Beta to Stable

### Step 1: Scaffold the entry in the beta registry

`add-wallet` writes a starter entry with all capabilities set to `false` and `supportedNetworks` set to all three networks. After running it, open `registry/v1/beta/registry.json` and edit your entry to set the real `capabilities`, `supportedNetworks`, `adapter.transport`, `installation`, `providerDetection`, and `cip0103` values.

```bash
partylayer-registry add-wallet \
  --channel beta \
  --walletId mywallet \
  --name "My Wallet" \
  --adapterPackage "@mywallet/adapter" \
  --adapterRange ">=1.0.0" \
  --homepage "https://mywallet.com" \
  --icon "https://mywallet.com/icon.svg"
```

The available `add-wallet` flags are exactly: `--channel`, `--walletId`, `--name`, `--adapterPackage`, `--adapterRange`, `--homepage`, `--icon`, `--sign`, `--key`. There are no flags for capabilities, networks, or detection. Edit those directly in the JSON.

### Step 2: Run conformance tests

```bash
# Build adapter
cd packages/adapters/mywallet
pnpm build

# Run conformance
partylayer-conformance run --adapter ./dist

# Verify all tests pass
```

### Step 3: Sign the registry

```bash
partylayer-registry sign \
  --channel beta \
  --key ./registry/keys/dev.key
```

### Step 4: Verify the signature

```bash
partylayer-registry verify \
  --channel beta \
  --pubkey ./registry/keys/dev.pub
```

### Step 5: Promote to stable

After the beta testing period (`--key` is optional and signs the target after promotion):

```bash
partylayer-registry promote \
  --from beta \
  --to stable \
  --key ./registry/keys/dev.key
```

## Key Rotation

### Adding a New Key

1. Generate a new key pair:
   ```bash
   # Generate Ed25519 key pair
   openssl genpkey -algorithm Ed25519 -out new-private.key
   openssl pkey -pubout -in new-private.key -out new-public.pub
   ```

2. Add the public key to the SDK config:
   ```typescript
   const client = createPartyLayer({
     network: 'mainnet',
     app: { name: 'My dApp' },
     registryPublicKeys: [
       'old-public-key-base64',
       'new-public-key-base64',
     ],
   });
   ```

3. Sign the registry with the new key:
   ```bash
   partylayer-registry sign --channel stable --key new-private.key
   ```

4. After the transition period, remove the old key from the config.

## Rollback Procedure

If a bad registry is published:

1. Identify the last known good sequence:
   ```bash
   partylayer-registry print-status --channel stable
   ```

2. Restore from cache (the SDK automatically uses the last known good registry).

3. Fix the registry and publish with a higher sequence:
   ```bash
   partylayer-registry bump-sequence --channel stable
   partylayer-registry sign --channel stable --key ./registry/keys/dev.key
   ```

## Required Fields Checklist

- [ ] `id`: unique identifier within the channel
- [ ] `name`: display name
- [ ] `supportedNetworks`: array of supported networks
- [ ] `capabilities`: object with all six required booleans (`signMessage`, `signTransaction`, `submitTransaction`, `transactionStatus`, `switchNetwork`, `multiParty`)
- [ ] `adapter.type`: adapter package name or logical type
- [ ] `adapter.transport`: `injected`, `announce`, or `discovery-adapter` (if not a default injected adapter)
- [ ] `cip0103.native`: `true` for confirmed CIP-0103 wallets
- [ ] `homepage`, `icon`: recommended for the picker
- [ ] `installation` and/or `providerDetection`: detection hints (if applicable)

## Security Considerations

- **Origin Allowlist**: use for production wallets to restrict access.
- **Signature Verification**: always verify registry signatures.
- **Sequence Numbers**: never decrease the sequence (prevents downgrade attacks).

## Support

- Registry CLI: `partylayer-registry --help`
- Security: security@partylayer.xyz
