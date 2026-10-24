# Console Wallet Integration

**References:**
- [Console DApp SDK](https://www.npmjs.com/package/@console-wallet/dapp-sdk)
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

## Overview

The default PartyLayer catalog connects Console through CIP-0103 announce and
official discovery. Ordinary React apps use `PartyLayerKit` and `ConnectButton`;
no separate Console package or registration is required. Native account/network
responses and declared signing encoding are preserved.

The examples below describe the **explicit legacy `ConsoleAdapter` compatibility
path**, including its extension and QR/deep-link modes. These modes and the legacy
sign-only capability are not guarantees of the default native path. Inspect the
connected session capabilities. See the [current wallet matrix](../wallet-cip0103-matrix.md)
and [native migration guidance](../protocol-ownership.md).

## Legacy compatibility connection modes

The Console adapter supports three connection modes:

| Mode | Transport | Use Case |
|------|-----------|----------|
| `combined` (default) | Extension preferred, QR/deep link fallback | Best for most dApps |
| `local` | Browser extension only | When mobile support is not needed |
| `remote` | QR code / deep link only | Mobile-first experiences |

### Combined Mode (Default)

The default mode. Tries the browser extension first; if not detected, falls back to QR code / deep link for mobile wallet connection.

```typescript
import { ConsoleAdapter } from '@partylayer/adapter-console';

// Combined mode is the default, no config needed
const adapter = new ConsoleAdapter();
```

### Local Mode (Extension Only)

Restricts to the browser extension. Fails if the extension is not installed.

```typescript
const adapter = new ConsoleAdapter({ target: 'local' });
```

### Remote Mode (Mobile Only)

Forces QR code / deep link flow. No extension detection.

```typescript
const adapter = new ConsoleAdapter({ target: 'remote' });
```

## Legacy wrapper capabilities

The compatibility wrapper exposes:
- Connect/Disconnect
- Sign Message
- Sign Transaction
- Submit Transaction
- Ledger API proxy (CIP-0103)
- Events
- Session restore (extension and remote)
- QR code / deep link mobile connect

## Limitations

- **Network Switching**: Not supported. Requires reconnection.
- **Multi-Party**: Not supported.

## Common Errors

### WALLET_NOT_INSTALLED

**Cause**: Console Wallet extension not detected (in `local` mode).

**Solution**: Install Console Wallet browser extension, or use `combined` mode for automatic QR fallback.

### USER_REJECTED

**Cause**: User rejected connection or signing request.

**Solution**: User action required, no programmatic fix.

### ORIGIN_NOT_ALLOWED

**Cause**: Origin not in Console Wallet's allowlist.

**Solution**: Add your origin to Console Wallet's allowed origins.

## Troubleshooting

### Extension Not Detected

1. Ensure Console Wallet extension is installed and enabled
2. Refresh the page
3. Check browser console for extension errors
4. Use `combined` mode: the adapter will fall back to QR code

### Connection Fails

1. Check that Console Wallet is unlocked
2. Verify network matches (devnet/testnet/mainnet)
3. Check browser console for detailed error messages

### Signing Fails

1. Ensure you have an active session
2. Verify the wallet supports the operation
3. Check that user approved the signing request

## Origin Binding

Console Wallet enforces origin binding. Sessions are bound to the origin that created them. PartyLayer also scopes native restoration to live matching wallet identity, network and application origin. Application authentication still requires server-side challenge verification and CSRF/session protection; a wallet connection alone is not an application login.

## See Also

- [Console DApp SDK Documentation](https://www.npmjs.com/package/@console-wallet/dapp-sdk)
- [Error Codes Reference](../errors.md)
