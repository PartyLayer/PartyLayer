# Event Specification

This document defines the event payloads emitted by PartyLayer SDK.

## Event System Overview

PartyLayer uses a typed event system for state changes:

```typescript
client.on('session:connected', (event) => {
  console.log('Connected:', event.session.partyId);
});

// Unsubscribe
const unsubscribe = client.on('error', handler);
unsubscribe();
```

---

## Event Types

### session:connected

Emitted when a wallet connection is established (new or restored).

```typescript
interface SessionConnectedEvent {
  type: 'session:connected';
  session: Session;
}

interface Session {
  sessionId: SessionId;
  walletId: WalletId;
  partyId: PartyId;
  network: NetworkId;
  createdAt: number;          // Unix timestamp (ms)
  expiresAt?: number;         // Unix timestamp (ms), optional
  origin: string;             // Origin that created session
  capabilitiesSnapshot: CapabilityKey[];
  metadata?: Record<string, string>;
}
```

**Triggered by:**
- `client.connect()` success
- Session restore on SDK initialization

**Metrics mapping:**
- `wallet_connect_success` +1
- `sessions_created` +1 (new connection only)
- `sessions_restored` +1 (restore only)

---

### session:disconnected

Emitted when a wallet is disconnected.

```typescript
interface SessionDisconnectedEvent {
  type: 'session:disconnected';
  sessionId: SessionId;
}
```

**Triggered by:**
- `client.disconnect()` call

**Metrics mapping:**
- No direct metric (tracked as session lifecycle)

---

### session:expired

Emitted when a session expires.

```typescript
interface SessionExpiredEvent {
  type: 'session:expired';
  sessionId: SessionId;
}
```

**Triggered by:**
- Session expiration check in `getActiveSession()`
- Failed session restore

**Metrics mapping:**
- No direct metric (tracked as session lifecycle)

---

### tx:status

Emitted when transaction status changes.

```typescript
interface TxStatusEvent {
  type: 'tx:status';
  sessionId: SessionId;
  txId: TransactionHash;
  status: TransactionStatus;
  raw?: unknown;
}

type TransactionStatus = 'pending' | 'submitted' | 'committed' | 'rejected' | 'failed';
```

**Triggered by:**
- `client.signTransaction()` → status: 'pending'
- `client.submitTransaction()` → status: 'submitted'

**Metrics mapping:**
- No direct metric (transaction counts not tracked for privacy)

---

### registry:status

Emitted when registry status changes.

```typescript
interface RegistryStatusEvent {
  type: 'registry:status';
  status: RegistryStatus;
}

interface RegistryStatus {
  source: 'network' | 'cache';
  verified: boolean;
  channel: 'stable' | 'beta';
  sequence: number;
  stale: boolean;
  fetchedAt: number;
  etag?: string;
  error?: PartyLayerError;
}
```

**Triggered by:**
- SDK initialization
- `client.listWallets()` call
- Registry fetch success/failure

**Metrics mapping:**
- `registry_fetch` +1 (when source: 'network')
- `registry_cache_hit` +1 (when source: 'cache')
- `registry_stale` +1 (when stale: true)

---

### error

Emitted when an error occurs during any operation.

```typescript
interface ErrorEvent {
  type: 'error';
  error: PartyLayerError;
}

interface PartyLayerError extends Error {
  code: ErrorCode;
  cause?: unknown;
  details?: Record<string, unknown>;
  isOperational: boolean;
}
```

**Triggered by:**
- Any SDK operation failure

**Metrics mapping:**
- `error_<code>` +1 (e.g., `error_USER_REJECTED`)

---

### session:networkMismatch

Emitted when the connected wallet's effective network differs from the dApp's configured network. Emitted under all policies (informational); `enforced` is true when the active policy (`guard` or `strict`) will block.

```typescript
interface SessionNetworkMismatchEvent {
  type: 'session:networkMismatch';
  sessionId: SessionId;
  expected: string; // dApp-configured network, CAIP-2 normalized
  actual: string;   // wallet-reported network, CAIP-2 normalized
  enforced: boolean; // true under guard|strict, false under off
}
```

**Triggered by:**
- A network mismatch detected at connect or restore time

**Metrics mapping:**
- No direct metric

---

### wallets:changed

Emitted when the available wallet list changes, currently only from late or inject-time announce discovery.

```typescript
interface WalletsChangedEvent {
  type: 'wallets:changed';
  reason: 'announced';
}
```

**Triggered by:**
- A `canton:announceProvider` wallet appearing after the initial list was built

**Metrics mapping:**
- No direct metric

---

## Event → Metric Mapping Table

| Event | Condition | Metric |
|-------|-----------|--------|
| `session:connected` | Always | `wallet_connect_success` |
| `session:connected` | New connection | `sessions_created` |
| `session:connected` | Restore | `sessions_restored` |
| `registry:status` | source='network' | `registry_fetch` |
| `registry:status` | source='cache' | `registry_cache_hit` |
| `registry:status` | stale=true | `registry_stale` |
| `error` | Always | `error_<code>` |
| `connect()` call | Always | `wallet_connect_attempts` |
| `restore()` call | Always | `restore_attempts` |

---

## Event telemetry bridge

Separately from the increment-based metrics above, every emitted event is forwarded
once to the configured telemetry adapter through `track(name, properties)`, from a
single central path in the client. The telemetry name is the event's own `type`
string. This is additive: the increment metrics are unchanged, and when no telemetry
adapter is configured the bridge is a no-op.

Only privacy-safe, non-identifying properties are sent. Session ids, party ids,
transaction hashes, origins, and raw wallet payloads are never included; where an
event's only distinguishing field is such an identifier, the property set is empty
and the event count itself is the signal.

| Event | Telemetry properties |
|-------|----------------------|
| `session:connected`      | `walletId`, `network` |
| `session:disconnected`   | (none) |
| `session:expired`        | (none) |
| `session:networkMismatch`| `expected`, `actual`, `enforced` |
| `tx:status`              | `status` |
| `registry:status`        | `source`, `channel`, `verified`, `stale`, `sequence` |
| `registry:updated`       | `channel`, `version` |
| `error`                  | `code` (when the error carries one) |
| `wallets:changed`        | `reason` |

---

## Privacy Guarantees

Event payloads are designed to be privacy-safe:

### Never Included in Events
- Wallet addresses
- Raw party IDs in external payloads
- Transaction payloads
- Signed message content
- User identifiers

### Included (Safe)
- Session IDs (random, not user-identifiable)
- Wallet IDs (e.g., 'console', 'loop')
- Network names (e.g., 'devnet', 'mainnet')
- Error codes (generic categories)
- Timestamps

### Opt-in (Hashed)
- App identifier (SHA-256 hashed)
- Origin (SHA-256 hashed, if enabled)

---

## Subscribing to Events

### Basic Usage

```typescript
// Subscribe
client.on('session:connected', (event) => {
  console.log('Connected:', event.session.partyId);
});

// Subscribe with unsubscribe
const unsubscribe = client.on('error', (event) => {
  console.error('Error:', event.error.code);
});

// Later: unsubscribe
unsubscribe();
```

### React Integration

```tsx
function MyComponent() {
  const client = usePartyLayer();
  
  useEffect(() => {
    const unsubscribe = client.on('session:expired', () => {
      // Handle expiration
    });
    return unsubscribe;
  }, [client]);
}
```

### Multiple Event Types

```typescript
// Each event type has its own handler
client.on('session:connected', handleConnect);
client.on('session:disconnected', handleDisconnect);
client.on('error', handleError);
```

---

## Event Handler Best Practices

1. **Keep handlers fast** - Don't block on async operations
2. **Handle errors** - Wrap handlers in try-catch
3. **Clean up** - Always unsubscribe when component unmounts
4. **Type safety** - Use TypeScript for event payload types

```typescript
// Good
client.on('error', (event) => {
  try {
    logError(event.error);
  } catch (e) {
    console.error('Handler failed:', e);
  }
});

// Bad - blocks event loop
client.on('session:connected', async (event) => {
  await longRunningOperation(); // Don't do this
});
```
