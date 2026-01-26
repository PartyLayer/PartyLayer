# CantonConnect Integration Guide

This guide shows how to integrate CantonConnect into a dApp using **only the public API**.

## Project Structure

```
test-dapp/
├── src/
│   ├── cantonconnect.ts          # Client initialization
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Main app component
│   └── components/
│       ├── ConnectButton.tsx      # Connect/disconnect UI
│       ├── SessionInfo.tsx        # Session display
│       ├── RegistryStatus.tsx     # Registry status display
│       ├── ErrorPanel.tsx         # Error display
│       └── EventLog.tsx           # Event log display
├── .env                           # Environment config
└── package.json                   # Dependencies
```

## Step-by-Step Integration

### 1. Install Packages

```bash
npm install @cantonconnect/sdk @cantonconnect/react
```

**Only public packages** - no internal imports.

### 2. Environment Configuration

Create `.env`:

```env
VITE_REGISTRY_URL=http://localhost:3001
VITE_REGISTRY_CHANNEL=stable
VITE_NETWORK=devnet
```

### 3. Initialize Client

`src/cantonconnect.ts`:

```typescript
import { createCantonConnect } from '@cantonconnect/sdk';

export function createClient() {
  return createCantonConnect({
    registryUrl: import.meta.env.VITE_REGISTRY_URL,
    channel: import.meta.env.VITE_REGISTRY_CHANNEL,
    network: import.meta.env.VITE_NETWORK,
    app: {
      name: 'Test DApp',
      origin: window.location.origin,
    },
  });
}
```

### 4. Setup Provider

`src/App.tsx`:

```typescript
import { CantonConnectProvider } from '@cantonconnect/react';
import { createClient } from './cantonconnect';

function App() {
  const client = createClient();
  
  return (
    <CantonConnectProvider client={client}>
      {/* Your app */}
    </CantonConnectProvider>
  );
}
```

### 5. Use Hooks

**Connect:**
```typescript
import { useConnect, WalletModal } from '@cantonconnect/react';

function ConnectButton() {
  const { connect, isConnecting } = useConnect();
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <WalletModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <button onClick={() => setIsOpen(true)}>
        Connect Wallet
      </button>
    </>
  );
}
```

**Session:**
```typescript
import { useSession } from '@cantonconnect/react';

function SessionInfo() {
  const session = useSession();
  
  if (!session) return <div>Not connected</div>;
  
  return (
    <div>
      <div>Wallet: {session.walletId}</div>
      <div>Party: {session.partyId}</div>
      <div>Capabilities: {session.capabilitiesSnapshot.join(', ')}</div>
    </div>
  );
}
```

**Registry Status:**
```typescript
import { useRegistryStatus } from '@cantonconnect/react';

function RegistryStatus() {
  const { status } = useRegistryStatus();
  
  if (!status) return <div>Loading...</div>;
  
  return (
    <div>
      <div>Channel: {status.channel}</div>
      <div>Verified: {status.verified ? '✓' : '✗'}</div>
      <div>Source: {status.source}</div>
    </div>
  );
}
```

**Disconnect:**
```typescript
import { useDisconnect } from '@cantonconnect/react';

function DisconnectButton() {
  const { disconnect, isDisconnecting } = useDisconnect();
  
  return (
    <button onClick={disconnect} disabled={isDisconnecting}>
      Disconnect
    </button>
  );
}
```

**Events:**
```typescript
import { useCantonConnect } from '@cantonconnect/react';

function EventLog() {
  const client = useCantonConnect();
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    const handler = (event) => {
      setEvents(prev => [event, ...prev]);
    };
    
    client.on('session:connected', handler);
    client.on('session:disconnected', handler);
    client.on('registry:status', handler);
    client.on('error', handler);
    
    return () => {
      client.off('session:connected', handler);
      client.off('session:disconnected', handler);
      client.off('registry:status', handler);
      client.off('error', handler);
    };
  }, [client]);
  
  return (
    <div>
      {events.map((event, i) => (
        <div key={i}>{event.type}: {JSON.stringify(event.payload)}</div>
      ))}
    </div>
  );
}
```

## Public API Reference

### From `@cantonconnect/sdk`:

- `createCantonConnect(config)` - Create client
- `CantonConnectClient` - Client type
- `Session` - Session type
- `WalletInfo` - Wallet info type
- `CantonConnectEvent` - Event types
- `CantonConnectError` - Error types

### From `@cantonconnect/react`:

- `CantonConnectProvider` - React provider
- `useCantonConnect()` - Get client
- `useWallets()` - Get wallets list
- `useSession()` - Get active session
- `useRegistryStatus()` - Get registry status
- `useConnect()` - Connect hook
- `useDisconnect()` - Disconnect hook
- `useSignMessage()` - Sign message hook
- `WalletModal` - Wallet selection modal

## Complete Example

See `src/App.tsx` and components for a complete working example.

## Common Patterns

### Error Handling

```typescript
import { useConnect } from '@cantonconnect/react';

function MyComponent() {
  const { connect, error } = useConnect();
  
  useEffect(() => {
    if (error) {
      console.error('Connection error:', error.code, error.message);
      // Show error to user
    }
  }, [error]);
}
```

### Session Restore

```typescript
import { useSession } from '@cantonconnect/react';

function MyComponent() {
  const session = useSession();
  
  if (session?.restoreReason === 'restore') {
    // Session was restored from storage
    console.log('Session restored');
  }
}
```

### Registry Status Monitoring

```typescript
import { useRegistryStatus } from '@cantonconnect/react';

function MyComponent() {
  const { status } = useRegistryStatus();
  
  if (status?.stale) {
    // Registry cache is stale, showing offline mode
    console.warn('Registry cache is stale');
  }
  
  if (status?.error) {
    // Registry error occurred
    console.error('Registry error:', status.error.code);
  }
}
```

## Testing

1. Start registry server: `cd apps/registry-server && pnpm start`
2. Run dApp: `cd examples/test-dapp && pnpm dev`
3. Open http://localhost:5173
4. Test connect/disconnect flows
5. Test error scenarios
6. Test session restore (refresh page)

## Troubleshooting

See `README.md` for common errors and solutions.
