# @cantonconnect/react

<div align="center">

**React hooks and components for CantonConnect**

[![npm version](https://img.shields.io/npm/v/@cantonconnect/react.svg?style=flat-square)](https://www.npmjs.com/package/@cantonconnect/react)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg?style=flat-square)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

</div>

---

## Overview

`@cantonconnect/react` provides React hooks and components for seamlessly integrating Canton Network wallet connectivity into your React application. Built on top of `@cantonconnect/sdk`, it offers a declarative API with built-in state management.

### Features

- **React Hooks**: `useSession`, `useWallets`, `useConnect`, `useSignMessage`, and more
- **Ready-to-Use Components**: Pre-built wallet modal with customizable styling
- **State Management**: Automatic session state synchronization
- **TypeScript**: Full type safety for all hooks and components
- **SSR Compatible**: Works with Next.js and other SSR frameworks

---

## Installation

```bash
npm install @cantonconnect/sdk @cantonconnect/react
```

---

## Quick Start

### 1. Set Up the Provider

```tsx
import { createCantonConnect } from '@cantonconnect/sdk';
import { CantonConnectProvider } from '@cantonconnect/react';

const client = createCantonConnect({
  network: 'devnet',
  app: { name: 'My dApp' },
});

function App() {
  return (
    <CantonConnectProvider client={client}>
      <MyApp />
    </CantonConnectProvider>
  );
}
```

### 2. Use Hooks in Your Components

```tsx
import { useSession, useConnect, useDisconnect } from '@cantonconnect/react';

function WalletButton() {
  const session = useSession();
  const { connect, isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  if (session) {
    return (
      <div>
        <p>Connected: {session.partyId}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <button onClick={() => connect()} disabled={isConnecting}>
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}
```

### 3. Use the Wallet Modal (Optional)

```tsx
import { useState } from 'react';
import { WalletModal, useSession } from '@cantonconnect/react';

function ConnectButton() {
  const [isOpen, setIsOpen] = useState(false);
  const session = useSession();

  if (session) {
    return <p>Connected: {session.partyId}</p>;
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Connect Wallet</button>
      <WalletModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

---

## Hooks Reference

### `useSession()`

Returns the current active session or `null` if not connected.

```tsx
const session = useSession();

if (session) {
  console.log('Party ID:', session.partyId);
  console.log('Wallet:', session.walletId);
  console.log('Network:', session.network);
}
```

### `useWallets()`

Returns the list of available wallets and loading state.

```tsx
const { wallets, isLoading, error } = useWallets();

return (
  <ul>
    {wallets.map((wallet) => (
      <li key={wallet.walletId}>
        <img src={wallet.icon} alt={wallet.name} />
        {wallet.name}
      </li>
    ))}
  </ul>
);
```

### `useConnect()`

Hook for connecting to a wallet.

```tsx
const { connect, isConnecting, error } = useConnect();

// Connect to first available wallet
await connect();

// Connect to specific wallet
await connect({ walletId: 'console' });

// With options
await connect({
  walletId: 'loop',
  timeoutMs: 60000,
  requiredCapabilities: ['signMessage', 'signTransaction'],
});
```

### `useDisconnect()`

Hook for disconnecting from the current wallet.

```tsx
const { disconnect, isDisconnecting } = useDisconnect();

<button onClick={disconnect} disabled={isDisconnecting}>
  Disconnect
</button>
```

### `useSignMessage()`

Hook for signing messages.

```tsx
const { signMessage, isSigning, error } = useSignMessage();

const handleSign = async () => {
  const result = await signMessage({ message: 'Hello, Canton!' });
  console.log('Signature:', result.signature);
};
```

### `useCantonConnect()`

Returns the underlying SDK client for advanced usage.

```tsx
const client = useCantonConnect();

// Access SDK methods directly
const wallets = await client.listWallets();
```

### `useRegistryStatus()`

Returns the wallet registry status.

```tsx
const status = useRegistryStatus();

if (status?.stale) {
  console.log('Registry data may be outdated');
}
```

---

## Components

### `CantonConnectProvider`

The context provider that must wrap your application.

```tsx
<CantonConnectProvider client={client}>
  {children}
</CantonConnectProvider>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `client` | `CantonConnectClient` | Yes | The SDK client instance |
| `children` | `ReactNode` | Yes | Child components |

### `WalletModal`

A pre-built modal for wallet selection.

```tsx
<WalletModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConnect={(session) => console.log('Connected:', session)}
/>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Whether the modal is visible |
| `onClose` | `() => void` | Yes | Called when modal should close |
| `onConnect` | `(session: Session) => void` | No | Called after successful connection |

---

## Next.js Integration

For Next.js applications, initialize the client on the client side:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createCantonConnect, CantonConnectClient } from '@cantonconnect/sdk';
import { CantonConnectProvider } from '@cantonconnect/react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<CantonConnectClient | null>(null);

  useEffect(() => {
    const cantonClient = createCantonConnect({
      network: 'devnet',
      app: { name: 'My Next.js App' },
    });
    setClient(cantonClient);
    
    return () => cantonClient.destroy();
  }, []);

  if (!client) {
    return <div>Loading...</div>;
  }

  return (
    <CantonConnectProvider client={client}>
      {children}
    </CantonConnectProvider>
  );
}
```

---

## TypeScript

All hooks and components are fully typed:

```typescript
import type { Session, WalletInfo } from '@cantonconnect/react';

// Session type
const session: Session | null = useSession();

// Wallet info type
const { wallets }: { wallets: WalletInfo[] } = useWallets();
```

---

## Complete Example

```tsx
import { useState } from 'react';
import { createCantonConnect } from '@cantonconnect/sdk';
import {
  CantonConnectProvider,
  useSession,
  useWallets,
  useConnect,
  useDisconnect,
  useSignMessage,
  WalletModal,
} from '@cantonconnect/react';

const client = createCantonConnect({
  network: 'devnet',
  app: { name: 'My dApp' },
});

function WalletStatus() {
  const session = useSession();
  const { wallets, isLoading } = useWallets();
  const { connect, isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessage, isSigning } = useSignMessage();
  const [modalOpen, setModalOpen] = useState(false);

  if (session) {
    return (
      <div>
        <h2>Connected</h2>
        <p>Party: {session.partyId}</p>
        <p>Wallet: {session.walletId}</p>
        <button
          onClick={() => signMessage({ message: 'Test' })}
          disabled={isSigning}
        >
          {isSigning ? 'Signing...' : 'Sign Message'}
        </button>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Not Connected</h2>
      <button onClick={() => setModalOpen(true)}>
        Connect Wallet
      </button>
      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <CantonConnectProvider client={client}>
      <WalletStatus />
    </CantonConnectProvider>
  );
}
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [@cantonconnect/sdk](https://www.npmjs.com/package/@cantonconnect/sdk) | Core SDK (required) |
| [@cantonconnect/core](https://www.npmjs.com/package/@cantonconnect/core) | Core types and abstractions |

---

## Links

- [GitHub Repository](https://github.com/cayvox/CantonConnect)
- [Documentation](https://github.com/cayvox/CantonConnect#readme)
- [Report Issues](https://github.com/cayvox/CantonConnect/issues)
- [Canton Network](https://www.canton.network/)

---

## License

MIT
