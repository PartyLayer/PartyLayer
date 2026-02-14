# @partylayer/adapter-starter

<div align="center">

**Starter template for building PartyLayer wallet adapters**

[![npm version](https://img.shields.io/npm/v/@partylayer/adapter-starter.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/adapter-starter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

A starter template for building wallet adapters for PartyLayer SDK.

## Quick Start

1. **Copy this package** to your project:
   ```bash
   cp -r packages/adapter-starter packages/adapters/my-wallet
   ```

2. **Rename and customize**:
   - Rename `adapter.ts` to match your wallet (e.g., `mywallet-adapter.ts`)
   - Update `walletId` and `name` in the adapter class
   - Update `package.json` name and description

3. **Implement required methods**:
   - `detectInstalled()` - Check if wallet is available
   - `connect()` - Establish connection and return partyId
   - `getCapabilities()` - Return supported capabilities

4. **Implement optional methods** (if supported):
   - `signMessage()` - Sign messages
   - `signTransaction()` - Sign transactions
   - `submitTransaction()` - Submit transactions
   - `restore()` - Restore sessions

5. **Run conformance tests**:
   ```bash
   partylayer-conformance run --adapter ./dist
   ```

## Adapter Contract

All adapters must implement the `WalletAdapter` interface from `@partylayer/core`:

```typescript
interface WalletAdapter {
  readonly walletId: WalletId;
  readonly name: string;
  
  getCapabilities(): CapabilityKey[];
  detectInstalled(): Promise<AdapterDetectResult>;
  connect(ctx: AdapterContext, opts?): Promise<AdapterConnectResult>;
  disconnect(ctx: AdapterContext, session: Session): Promise<void>;
  
  // Optional methods:
  restore?(ctx: AdapterContext, persisted: PersistedSession): Promise<Session | null>;
  signMessage?(ctx: AdapterContext, session: Session, params: SignMessageParams): Promise<SignedMessage>;
  signTransaction?(ctx: AdapterContext, session: Session, params: SignTransactionParams): Promise<SignedTransaction>;
  submitTransaction?(ctx: AdapterContext, session: Session, params: SubmitTransactionParams): Promise<TxReceipt>;
}
```

## Capability Mapping

Declare capabilities your wallet supports:

- `connect` - Required: wallet can connect
- `disconnect` - Required: wallet can disconnect
- `restore` - Optional: wallet supports session restoration
- `signMessage` - Optional: wallet can sign messages
- `signTransaction` - Optional: wallet can sign transactions
- `submitTransaction` - Optional: wallet can submit transactions
- `events` - Optional: wallet emits events
- `injected` - Optional: browser extension (injected script)
- `popup` - Optional: uses popup flow
- `deeplink` - Optional: uses deep link flow
- `remoteSigner` - Optional: enterprise remote signer

## Error Mapping

Always use `mapUnknownErrorToPartyLayerError()` to normalize errors:

```typescript
try {
  // Wallet SDK call
} catch (err) {
  throw mapUnknownErrorToPartyLayerError(err, {
    walletId: this.walletId,
    phase: 'connect', // or 'signMessage', 'signTransaction', etc.
    transport: 'injected', // or 'popup', 'deeplink', 'remote'
  });
}
```

## Install Hints

For registry entry, provide `installHints`:

```json
{
  "installHints": {
    "injectedKey": "myWallet", // window.myWallet
    "extensionId": "abc123...", // Chrome extension ID
    "deepLinkScheme": "mywallet", // mywallet://
    "universalLinkBase": "https://app.mywallet.com"
  }
}
```

## Origin Allowlist

If your wallet supports origin allowlist, include it in registry entry:

```json
{
  "originAllowlist": [
    "https://myapp.com",
    "https://*.myapp.com"
  ]
}
```

SDK will enforce this automatically.

## Testing

### Local Conformance Tests

```bash
# Build your adapter
pnpm build

# Run conformance tests
partylayer-conformance run --adapter ./dist

# View report
partylayer-conformance report --input conformance-report.json
```

### Integration Testing

Test your adapter in a demo dApp:

```typescript
import { createPartyLayer } from '@partylayer/sdk';
import { MyWalletAdapter } from '@mywallet/adapter';

const client = createPartyLayer({
  registryUrl: 'https://registry.partylayer.xyz',
  network: 'devnet',
  app: { name: 'My dApp' },
});

// Register adapter
client.registerAdapter(new MyWalletAdapter());

// Connect
const session = await client.connect({ walletId: 'mywallet' });
```

## Security Checklist

- ✅ State parameter (nonce) for CSRF protection
- ✅ Origin validation
- ✅ Redirect URI validation
- ✅ Timeout enforcement
- ✅ Error mapping (never expose sensitive errors)
- ✅ No private keys stored (only session metadata)
- ✅ Signing payload display (user-friendly format)

See `docs/security-checklist.md` for complete checklist.

## Registry Onboarding

1. **Add to beta registry**:
   ```bash
   partylayer-registry add-wallet \
     --channel beta \
     --walletId mywallet \
     --name "My Wallet" \
     --adapterPackage "@mywallet/adapter" \
     --adapterRange "^1.0.0" \
     --capabilities connect,disconnect,signMessage \
     --installHints '{"injectedKey":"myWallet"}' \
     --docs '["https://docs.mywallet.com"]'
   ```

2. **Run conformance tests** (must pass)

3. **Promote to stable**:
   ```bash
   partylayer-registry promote --from beta --to stable
   ```

See `docs/registry-onboarding.md` for detailed workflow.

## Examples

See existing adapters for reference:
- `packages/adapters/console` - Browser extension adapter
- `packages/adapters/loop` - QR code/popup adapter
- `packages/adapters/cantor8` - Deep link adapter with vendor module
- `packages/adapters/bron` - Enterprise remote signer adapter

## Support

- Documentation: `docs/wallet-provider-guide.md`
- Issues: GitHub Issues
- Security: security@partylayer.xyz
