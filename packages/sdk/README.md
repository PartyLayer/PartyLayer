# @partylayer/sdk

<div align="center">

**The official SDK for connecting dApps to Canton Network wallets**

[![npm version](https://img.shields.io/npm/v/@partylayer/sdk.svg?style=flat-square)](https://www.npmjs.com/package/@partylayer/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

`@partylayer/sdk` provides a unified interface for connecting your decentralized application (dApp) to multiple Canton Network wallets. Similar to WalletConnect, it abstracts wallet-specific implementations behind a simple, type-safe API.

### Features

- **Multi-Wallet Support**: Console, 5N Loop, Cantor8, and Bron wallets
- **Zero Configuration**: Works out of the box with sensible defaults
- **Type-Safe**: Full TypeScript support with strict mode
- **Secure**: Encrypted session storage with origin binding
- **Event-Driven**: Subscribe to connection, transaction, and error events

---

## Installation

```bash
npm install @partylayer/sdk
```

For React applications, also install the React integration:

```bash
npm install @partylayer/sdk @partylayer/react
```

---

## Quick Start

### 1. Create a Client

```typescript
import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
});
```

### 2. Connect to a Wallet

```typescript
// List available wallets
const wallets = await client.listWallets();
console.log('Available wallets:', wallets.map(w => w.name));

// Connect to a specific wallet
const session = await client.connect({ walletId: 'console' });
console.log('Connected! Party ID:', session.partyId);
```

### 3. Sign Messages & Transactions

```typescript
// Sign a message
const { signature } = await client.signMessage({
  message: 'Authorize login to My dApp',
});

// Sign a transaction
const { signedTx, transactionHash } = await client.signTransaction({
  tx: myTransaction,
});

// Submit a transaction
const receipt = await client.submitTransaction({
  signedTx,
});
```

### 4. Listen to Events

```typescript
// Connection events
client.on('session:connected', (event) => {
  console.log('Connected:', event.session.partyId);
});

client.on('session:disconnected', () => {
  console.log('Disconnected');
});

// Transaction events
client.on('tx:status', (event) => {
  console.log('Transaction status:', event.status);
});

// Error events
client.on('error', (event) => {
  console.error('Error:', event.error.message);
});
```

### 5. Disconnect

```typescript
await client.disconnect();
```

---

## Supported Wallets

| Wallet | ID | Type | Auto-Registered |
|--------|-----|------|-----------------|
| Console Wallet | `console` | Browser Extension | ✅ Yes |
| 5N Loop | `loop` | Mobile / Web | ✅ Yes |
| Cantor8 | `cantor8` | Browser Extension | ✅ Yes |
| Bron | `bron` | Enterprise (OAuth) | ⚙️ Requires config |

---

## Configuration

```typescript
const client = createPartyLayer({
  // Required
  network: 'devnet', // 'devnet' | 'testnet' | 'mainnet'
  app: {
    name: 'My dApp',
    origin: 'https://mydapp.com', // Optional, defaults to window.location.origin
  },

  // Optional
  registryUrl: 'https://registry.partylayer.xyz/v1/wallets.json', // Default
  channel: 'stable', // 'stable' | 'beta'
  
  // Advanced: Custom adapters
  adapters: [
    ...getBuiltinAdapters(),
    new BronAdapter({ auth: {...}, api: {...} }),
  ],
});
```

---

## API Reference

### `createPartyLayer(config)`

Creates a new PartyLayer client instance.

### Client Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `listWallets(filter?)` | List available wallets | `Promise<WalletInfo[]>` |
| `connect(options?)` | Connect to a wallet | `Promise<Session>` |
| `disconnect()` | Disconnect current session | `Promise<void>` |
| `getActiveSession()` | Get active session | `Promise<Session \| null>` |
| `signMessage(params)` | Sign an arbitrary message | `Promise<SignedMessage>` |
| `signTransaction(params)` | Sign a transaction | `Promise<SignedTransaction>` |
| `submitTransaction(params)` | Submit signed transaction | `Promise<TxReceipt>` |
| `on(event, handler)` | Subscribe to events | `() => void` (unsubscribe) |
| `off(event, handler)` | Unsubscribe from events | `void` |
| `destroy()` | Cleanup client resources | `void` |

### Events

| Event | Description |
|-------|-------------|
| `session:connected` | Wallet connected successfully |
| `session:disconnected` | Wallet disconnected |
| `session:expired` | Session has expired |
| `tx:status` | Transaction status update |
| `registry:status` | Registry status change |
| `error` | Error occurred |

---

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
    console.log('Please install the wallet extension');
  } else if (error instanceof UserRejectedError) {
    console.log('User rejected the connection request');
  } else if (error instanceof TimeoutError) {
    console.log('Connection timed out');
  }
}
```

---

## Using Bron (Enterprise Wallet)

Bron requires OAuth2 configuration:

```typescript
import { createPartyLayer, BronAdapter, getBuiltinAdapters } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
  adapters: [
    ...getBuiltinAdapters(),
    new BronAdapter({
      auth: {
        clientId: 'your-client-id',
        redirectUri: 'https://your-app.com/auth/callback',
        authorizationUrl: 'https://auth.bron.example/authorize',
        tokenUrl: 'https://auth.bron.example/token',
      },
      api: {
        baseUrl: 'https://api.bron.example',
        getAccessToken: async () => getStoredAccessToken(),
      },
    }),
  ],
});
```

---

## TypeScript

This package is written in TypeScript and includes type definitions. All types are exported:

```typescript
import type {
  Session,
  WalletInfo,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  PartyLayerConfig,
  ConnectOptions,
} from '@partylayer/sdk';
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [@partylayer/react](https://www.npmjs.com/package/@partylayer/react) | React hooks and components |
| [@partylayer/core](https://www.npmjs.com/package/@partylayer/core) | Core types and abstractions |

---

## Links

- [GitHub Repository](https://github.com/cayvox/PartyLayer)
- [Documentation](https://github.com/cayvox/PartyLayer#readme)
- [Report Issues](https://github.com/cayvox/PartyLayer/issues)
- [Canton Network](https://www.canton.network/)

---

## License

MIT
