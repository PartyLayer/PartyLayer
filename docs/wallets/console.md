# Console Wallet Integration

**References:**
- [Console DApp SDK](https://www.npmjs.com/package/@console-wallet/dapp-sdk)
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

## Overview

Console Wallet is the official wallet for Canton Network provided by Digital Asset. The adapter integrates with Console Wallet's browser extension.

## Installation

Console Wallet must be installed as a browser extension. The adapter detects it via `window.consoleWallet`.

### Install Steps

1. Install Console Wallet browser extension
2. Create an account and set up your party
3. The adapter will automatically detect the extension

## Usage

```typescript
import { createCantonConnect } from '@cantonconnect/sdk';
import { ConsoleAdapter } from '@cantonconnect/adapter-console';

const client = createCantonConnect({
  registryUrl: '...',
  network: 'devnet',
  app: { name: 'My dApp' },
});

// Register adapter (in production, auto-registered via registry)
client.registerAdapter(new ConsoleAdapter());

// Connect
const session = await client.connect({ walletId: 'console' });
```

## Capabilities

Console Wallet supports:
- ✅ Connect/Disconnect
- ✅ Sign Message
- ✅ Sign Transaction
- ✅ Submit Transaction
- ✅ Events
- ✅ Injected (browser extension)

## Limitations

- **Session Restoration**: Console Wallet sessions are ephemeral and cannot be restored. Users must reconnect after page refresh.
- **Network Switching**: Not supported. Requires reconnection.
- **Multi-Party**: Not supported.

## Common Errors

### WALLET_NOT_INSTALLED

**Cause**: Console Wallet extension not detected.

**Solution**: Install Console Wallet browser extension.

### USER_REJECTED

**Cause**: User rejected connection or signing request.

**Solution**: User action required - no programmatic fix.

### ORIGIN_NOT_ALLOWED

**Cause**: Origin not in Console Wallet's allowlist.

**Solution**: Add your origin to Console Wallet's allowed origins.

## Troubleshooting

### Extension Not Detected

1. Ensure Console Wallet extension is installed and enabled
2. Refresh the page
3. Check browser console for extension errors

### Connection Fails

1. Check that Console Wallet is unlocked
2. Verify network matches (devnet/mainnet/local)
3. Check browser console for detailed error messages

### Signing Fails

1. Ensure you have an active session
2. Verify the wallet supports the operation
3. Check that user approved the signing request

## Origin Binding

Console Wallet enforces origin binding. Sessions are bound to the origin that created them. This prevents:
- Session hijacking across domains
- Cross-site request forgery

## See Also

- [Console DApp SDK Documentation](https://www.npmjs.com/package/@console-wallet/dapp-sdk)
- [Error Codes Reference](../errors.md)
