# Wallet Provider Guide

**How to build a CantonConnect wallet adapter**

## What is CantonConnect?

CantonConnect is a developer SDK that provides a WalletConnect-like experience for Canton Network wallets. It allows dApps to connect to multiple wallet types through a single integration point.

## How Adapters Work

Adapters are the bridge between CantonConnect SDK and individual wallet implementations. Each adapter:

1. **Implements the WalletAdapter interface** - Standard contract for all wallets
2. **Detects wallet availability** - Checks if wallet is installed/available
3. **Establishes connections** - Connects to wallet and retrieves party ID
4. **Handles signing** - Signs messages and transactions
5. **Maps errors** - Normalizes wallet-specific errors to CantonConnect errors

## Getting Started

### 1. Use the Adapter Starter Template

```bash
# Copy the starter template
cp -r packages/adapter-starter packages/adapters/my-wallet

# Rename and customize
cd packages/adapters/my-wallet
# Edit adapter.ts, update walletId and name
# Edit package.json, update name and description
```

### 2. Implement Required Methods

#### `detectInstalled()`

Check if your wallet is available:

```typescript
async detectInstalled(): Promise<AdapterDetectResult> {
  if (typeof window === 'undefined') {
    return { installed: false, reason: 'Browser required' };
  }

  // Example: Check for browser extension
  const wallet = (window as any).myWallet;
  if (!wallet) {
    return {
      installed: false,
      reason: 'My Wallet extension not detected',
    };
  }

  return { installed: true };
}
```

#### `connect()`

Establish connection and return party ID:

```typescript
async connect(ctx: AdapterContext, opts?): Promise<AdapterConnectResult> {
  const detect = await this.detectInstalled();
  if (!detect.installed) {
    throw new WalletNotInstalledError(this.walletId, detect.reason);
  }

  const wallet = (window as any).myWallet;
  const result = await wallet.connect({
    appName: ctx.appName,
    network: ctx.network,
  });

  return {
    partyId: toPartyId(result.partyId),
    session: {
      walletId: this.walletId,
      network: ctx.network,
      createdAt: Date.now(),
    },
    capabilities: this.getCapabilities(),
  };
}
```

#### `getCapabilities()`

Declare what your wallet supports:

```typescript
getCapabilities(): CapabilityKey[] {
  return [
    'connect',
    'disconnect',
    'signMessage', // If supported
    'signTransaction', // If supported
    'injected', // If browser extension
  ];
}
```

### 3. Implement Optional Methods

Only implement methods for capabilities you declared:

```typescript
async signMessage(ctx, session, params): Promise<SignedMessage> {
  // Only implement if 'signMessage' is in capabilities
  const wallet = (window as any).myWallet;
  const signature = await wallet.signMessage(params.message);
  
  return {
    message: params.message,
    signature: toSignature(signature),
    partyId: session.partyId,
  };
}
```

If a capability is not supported, throw `CapabilityNotSupportedError`:

```typescript
async signTransaction(...): Promise<SignedTransaction> {
  throw new CapabilityNotSupportedError(this.walletId, 'signTransaction');
}
```

## Error Mapping

Always use `mapUnknownErrorToCantonConnectError()`:

```typescript
try {
  // Wallet SDK call
  await wallet.connect();
} catch (err) {
  throw mapUnknownErrorToCantonConnectError(err, {
    walletId: this.walletId,
    phase: 'connect', // or 'signMessage', 'signTransaction', etc.
    transport: 'injected', // or 'popup', 'deeplink', 'remote'
  });
}
```

This ensures:
- Consistent error codes across wallets
- User-friendly error messages
- Proper error propagation to dApps

## Security Expectations

### State Parameter (Nonce)

Always use a state parameter for CSRF protection:

```typescript
const state = this.generateState(); // Random 32-byte nonce
// Include state in request
// Validate state in callback
if (callback.state !== request.state) {
  throw new Error('State mismatch');
}
```

### Origin Validation

Validate callback origins:

```typescript
const allowedOrigins = ['https://myapp.com'];
if (!allowedOrigins.includes(event.origin)) {
  return; // Ignore message
}
```

### Redirect URI Validation

Validate redirect URIs match expected values:

```typescript
const expectedRedirectUri = 'https://myapp.com/callback';
if (callback.redirectUri !== expectedRedirectUri) {
  throw new Error('Invalid redirect URI');
}
```

See `docs/security-checklist.md` for complete checklist.

## Running Conformance Tests

### Local Testing

```bash
# Build your adapter
pnpm build

# Run conformance tests
cantonconnect-conformance run --adapter ./dist

# View report
cantonconnect-conformance report --input conformance-report.json
```

### Interpreting Results

The conformance report shows:
- ✅ Passed tests
- ✗ Failed tests with error details
- Summary statistics

All tests must pass for registry inclusion.

## Registry Onboarding

See `docs/registry-onboarding.md` for:
- Required registry fields
- Beta → stable promotion workflow
- Key rotation procedures

## Examples

- **Browser Extension**: See `packages/adapters/console`
- **QR Code/Popup**: See `packages/adapters/loop`
- **Deep Link**: See `packages/adapters/cantor8`
- **Remote Signer**: See `packages/adapters/bron`

## Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Security: security@cantonconnect.io
