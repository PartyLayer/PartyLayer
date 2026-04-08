# Quick Start Guide

**References:**
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Signing transactions from dApps](https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html)
- [OpenRPC dApp API spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)

## Installation

```bash
npm install @partylayer/sdk @partylayer/react
```

**No need to install wallet adapters separately** — Console, Loop, Cantor8, and Nightly are all bundled in the SDK!

## React — Zero Config (Recommended)

The fastest way to add wallet connectivity:

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <ConnectButton />
      <YourApp />
    </PartyLayerKit>
  );
}
```

`PartyLayerKit` handles everything:
- Creates and manages the SDK client
- Registers all built-in wallet adapters
- Auto-discovers native CIP-0103 wallets (`window.canton.*`)
- Provides theming (light/dark/auto)

`ConnectButton` is a polished button with:
- Wallet selection modal
- Connecting/success/error states
- Connected dropdown with party ID and disconnect

### Dark Mode

```tsx
<PartyLayerKit network="devnet" appName="My dApp" theme="dark">
  <ConnectButton />
</PartyLayerKit>
```

Use `"auto"` to follow the user's OS preference.

### Custom Wallet Icons

```tsx
<PartyLayerKit
  network="devnet"
  appName="My dApp"
  walletIcons={{
    console: '/wallets/console.svg',
    loop: '/wallets/loop.svg',
  }}
>
  <ConnectButton />
</PartyLayerKit>
```

## React — Custom UI with Hooks

For full control, use hooks directly:

```tsx
import {
  PartyLayerKit,
  useSession,
  useWallets,
  useConnect,
  useDisconnect,
  useSignMessage,
} from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <WalletStatus />
    </PartyLayerKit>
  );
}

function WalletStatus() {
  const session = useSession();
  const { wallets, isLoading } = useWallets();
  const { connect, isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessage } = useSignMessage();

  if (session) {
    return (
      <div>
        <p>Connected: {session.partyId}</p>
        <button onClick={disconnect}>Disconnect</button>
        <button onClick={() => signMessage({ message: 'Hello!' })}>
          Sign Message
        </button>
      </div>
    );
  }

  if (isLoading) return <p>Discovering wallets...</p>;

  return (
    <div>
      {wallets.map((wallet) => (
        <button
          key={String(wallet.walletId)}
          onClick={() => connect({ walletId: wallet.walletId })}
          disabled={isConnecting}
        >
          {wallet.name}
        </button>
      ))}
    </div>
  );
}
```

## Vanilla JavaScript

No React? Use the SDK directly:

```typescript
import { createPartyLayer } from '@partylayer/sdk';

// Create client — all wallet adapters are automatically included!
const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
});

// List available wallets (Console, Loop, Cantor8, Nightly — all ready to use)
const wallets = await client.listWallets();
console.log('Available wallets:', wallets.map(w => w.name));

// Connect to a wallet
const session = await client.connect({ walletId: 'console' });
console.log('Connected:', session.partyId);

// Sign a message
const signed = await client.signMessage({ message: 'Hello, Canton!' });

// Sign and submit a transaction
const signedTx = await client.signTransaction({ tx: myTransaction });
const receipt = await client.submitTransaction({ signedTx: signedTx.signedTx });

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

## Supported Wallets (Built-in)

| Wallet | Type | Transport | Auto-registered |
|--------|------|-----------|-----------------|
| Console Wallet | Browser Extension | PostMessage | ✅ Yes |
| 5N Loop | Mobile / Web | QR Code / Popup | ✅ Yes |
| Cantor8 (C8) | Browser Extension | Deep Link | ✅ Yes |
| Nightly | Multichain Wallet | Injected | ✅ Yes |
| Bron | Enterprise | OAuth2 / API | ⚙️ Requires config |

Additionally, any **CIP-0103 compliant wallet** injected at `window.canton.*` is auto-discovered at runtime — no adapter needed.

## Error Handling

```typescript
import {
  WalletNotFoundError,
  WalletNotInstalledError,
  UserRejectedError,
  SessionExpiredError,
  TimeoutError,
} from '@partylayer/sdk';

try {
  await client.connect({ walletId: 'console' });
} catch (error) {
  if (error instanceof WalletNotInstalledError) {
    console.error('Please install the wallet extension');
  } else if (error instanceof UserRejectedError) {
    console.error('User rejected the connection');
  } else if (error instanceof SessionExpiredError) {
    console.error('Session expired, please reconnect');
  } else if (error instanceof TimeoutError) {
    console.error('Connection timed out');
  } else {
    console.error('Connection failed:', error);
  }
}
```

The `WalletModal` component handles all these error states automatically with dedicated views for not-installed, rejected, and timeout scenarios.

## Advanced: Manual Client Setup

For advanced use cases where you need full control over the client:

```tsx
import { useMemo } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import { PartyLayerProvider } from '@partylayer/react';

function App() {
  const client = useMemo(() => createPartyLayer({
    registryUrl: 'https://registry.partylayer.xyz',
    network: 'devnet',
    app: { name: 'My dApp' },
    // Custom telemetry configuration
    telemetry: {
      enabled: true,
      endpoint: 'https://metrics.example.com',
      sampleRate: 0.1,
    },
  }), []);

  return (
    <PartyLayerProvider client={client} network="devnet">
      <MyDApp />
    </PartyLayerProvider>
  );
}
```

## See Also

- [API Reference](./api.md)
- [Architecture](./architecture.md)
- [Error Codes](./errors.md)
- [Adapter Guide](./adapters.md)
