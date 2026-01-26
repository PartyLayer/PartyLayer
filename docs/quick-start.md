# Quick Start Guide

**References:**
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Signing transactions from dApps](https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html)
- [OpenRPC dApp API spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)

## Installation

```bash
# That's all you need!
npm install @cantonconnect/sdk

# Optional: React integration
npm install @cantonconnect/react
```

**No need to install wallet adapters separately** - they're all bundled in the SDK!

## Basic Usage (3 lines of code!)

```typescript
import { createCantonConnect } from '@cantonconnect/sdk';

// Create client - ALL wallet adapters are automatically included!
const client = createCantonConnect({
  registryUrl: 'https://registry.cantonconnect.io',
  network: 'devnet',
  app: { name: 'My dApp' },
});

// List available wallets (Console, Loop, etc. - all ready to use)
const wallets = await client.listWallets();
console.log('Available wallets:', wallets.map(w => w.name));

// Connect to a wallet - just works!
const session = await client.connect({
  walletId: 'console', // Or 'loop', etc.
});

console.log('Connected:', session.partyId);
```

## Full Example

```typescript
import { createCantonConnect } from '@cantonconnect/sdk';

const client = createCantonConnect({
  registryUrl: 'https://registry.cantonconnect.io',
  network: 'devnet',
  app: { name: 'My dApp' },
});

// Connect to a wallet
const session = await client.connect();
console.log('Connected:', session.partyId);

// Sign a message
const signed = await client.signMessage({
  message: 'Hello, Canton!',
});

// Sign a transaction
const signedTx = await client.signTransaction({
  tx: { /* your transaction */ },
});

// Submit transaction
const receipt = await client.submitTransaction({
  signedTx: signedTx.signedTx,
});

// Listen to events
client.on('session:connected', (event) => {
  console.log('Session connected:', event.session);
});

client.on('error', (event) => {
  console.error('Error:', event.error);
});

// Disconnect
await client.disconnect();
```

## React Integration

```tsx
import { useState } from 'react';
import { CantonConnectProvider, WalletModal, useSession } from '@cantonconnect/react';
import { createCantonConnect } from '@cantonconnect/sdk';

// Create client - no adapter imports needed!
const client = createCantonConnect({
  registryUrl: 'https://registry.cantonconnect.io',
  network: 'devnet',
  app: { name: 'My dApp' },
});

// Wrap your app
function App() {
  return (
    <CantonConnectProvider client={client}>
      <MyApp />
    </CantonConnectProvider>
  );
}

// Use hooks in your components
function ConnectButton() {
  const session = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  if (session) {
    return <div>Connected: {session.partyId}</div>;
  }

  return (
    <>
      <button onClick={() => setModalOpen(true)}>Connect Wallet</button>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
```

## Supported Wallets (Built-in)

| Wallet | Type | Status |
|--------|------|--------|
| Console Wallet | Browser Extension | ✅ Ready |
| 5N Loop | QR Code / Popup | ✅ Ready (SDK auto-loaded) |

**No configuration needed** - all adapters are automatically registered and ready to use!

## Error Handling

```typescript
import {
  WalletNotFoundError,
  UserRejectedError,
  CapabilityNotSupportedError,
} from '@cantonconnect/sdk';

try {
  await client.connect();
} catch (error) {
  if (error instanceof WalletNotFoundError) {
    console.error('Wallet not found');
  } else if (error instanceof UserRejectedError) {
    console.error('User rejected connection');
  } else {
    console.error('Connection failed:', error);
  }
}
```

## See Also

- [API Reference](./api.md)
- [Error Codes](./errors.md)
- [Adapter Guide](./adapters.md)
