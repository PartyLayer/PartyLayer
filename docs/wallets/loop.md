# Loop Wallet Integration

**References:**
- [Loop SDK](https://github.com/fivenorth-io/loop-sdk)
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

## Overview

5N Loop is a mobile-first wallet for Canton Network. The adapter integrates with Loop SDK which uses QR code scanning or popup flows for connection.

## Installation

Loop SDK must be loaded before using the adapter.

### Option 1: NPM Package

```bash
npm install @fivenorth/loop-sdk
```

```typescript
import { loop } from '@fivenorth/loop-sdk';
// Loop SDK is now available on window.loop
```

### Option 2: Script Tag

```html
<script src="https://unpkg.com/@fivenorth/loop-sdk@0.8.0/dist"></script>
```

## Usage

```typescript
import { createCantonConnect } from '@cantonconnect/sdk';
import { LoopAdapter } from '@cantonconnect/adapter-loop';

const client = createCantonConnect({
  registryUrl: '...',
  network: 'devnet',
  app: { name: 'My dApp' },
});

// Register adapter (in production, auto-registered via registry)
client.registerAdapter(new LoopAdapter());

// Connect (opens QR code modal)
const session = await client.connect({ walletId: 'loop' });
```

## Connection Flow

1. **Initialize**: Adapter calls `loop.init()` with app name and network
2. **Connect**: Adapter calls `loop.connect()` which opens QR code modal
3. **Scan**: User scans QR code with Loop mobile app OR approves in popup
4. **Provider**: `onAccept` callback receives provider with `party_id`
5. **Session**: Adapter creates session with party ID

## Capabilities

Loop Wallet supports:
- ✅ Connect/Disconnect
- ✅ Sign Message
- ✅ Submit Transaction (signs and submits in one call)
- ✅ Events
- ✅ Popup (QR code flow)

**Note**: Loop SDK combines signing and submission. `signTransaction()` is not supported - use `submitTransaction()` instead.

## Limitations

- **Session Restoration**: Loop sessions are ephemeral and cannot be restored. Users must reconnect via QR code after page refresh.
- **Sign Transaction Only**: Loop SDK doesn't expose separate signing - use `submitTransaction()` which signs and submits.
- **Network Switching**: Not supported. Requires reconnection.
- **Multi-Party**: Not supported.

## Party ID

Party ID is obtained from `provider.party_id` after successful connection. This is the user's Canton Network party identifier.

## Common Errors

### WALLET_NOT_INSTALLED

**Cause**: Loop SDK not loaded.

**Solution**: 
- Include Loop SDK script tag, OR
- Import `@fivenorth/loop-sdk` package

### USER_REJECTED

**Cause**: User rejected connection or transaction.

**Solution**: User action required - no programmatic fix.

### TIMEOUT

**Cause**: User didn't complete QR scan within timeout (default 5 minutes).

**Solution**: Retry connection.

## Troubleshooting

### SDK Not Detected

1. Ensure Loop SDK is loaded (script tag or import)
2. Check `window.loop` exists in browser console
3. Verify SDK version compatibility

### QR Code Not Appearing

1. Check browser popup blocker settings
2. Ensure `loop.init()` was called before `loop.connect()`
3. Check browser console for errors

### Connection Timeout

1. Increase timeout in connect options
2. Ensure user has Loop mobile app installed
3. Check network connectivity

### Transaction Submission Fails

1. Verify DAML command structure matches Loop SDK expectations
2. Check that user approved transaction in Loop app
3. Review Loop SDK documentation for command format

## Reconnect Required

Since Loop doesn't support session restoration, users must reconnect after:
- Page refresh
- Browser restart
- Session expiration

The demo app should clearly indicate when reconnect is required.

## See Also

- [Loop SDK Repository](https://github.com/fivenorth-io/loop-sdk)
- [Error Codes Reference](../errors.md)
