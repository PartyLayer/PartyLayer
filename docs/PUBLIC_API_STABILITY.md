# Public API Stability

This document defines the public API stability guarantees for PartyLayer SDK.

## Versioning Policy

PartyLayer follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes to public API
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

> **Note:** During 0.x releases, MINOR versions may contain breaking changes with migration guides.

---

## Stable Public API (Will Not Break)

The following APIs are considered stable and will not have breaking changes without:
1. Major version bump
2. Deprecation notice (at least 1 minor version)
3. Migration guide

### Core Types (`@partylayer/core`)

```typescript
// Branded types - stable
WalletId
PartyId
SessionId
TransactionHash
Signature
NetworkId

// Core interfaces - stable
Session
WalletInfo
SignedMessage
SignedTransaction
TxReceipt

// Error classes - stable (codes will not change meaning)
PartyLayerError
WalletNotFoundError
WalletNotInstalledError
UserRejectedError
SessionExpiredError
TimeoutError
TransportError
```

### SDK Client (`@partylayer/sdk`)

```typescript
// Factory function - stable signature
createPartyLayer(config: PartyLayerConfig): PartyLayerClient

// PartyLayerConfig required fields - stable
interface PartyLayerConfig {
  network: NetworkId;           // Required, stable
  app: { name: string };        // Required, stable
  // Optional fields may be added
}

// Client methods - stable signatures
client.listWallets(filter?): Promise<WalletInfo[]>
client.connect(options?): Promise<Session>
client.disconnect(): Promise<void>
client.getActiveSession(): Promise<Session | null>
client.signMessage(params): Promise<SignedMessage>
client.signTransaction(params): Promise<SignedTransaction>
client.submitTransaction(params): Promise<TxReceipt>
client.on(event, handler): () => void
client.off(event, handler): void
client.destroy(): void
```

### React Hooks (`@partylayer/react`)

```typescript
// All hooks - stable signatures
usePartyLayer(): PartyLayerClient
useSession(): UseSessionReturn          // M1-S4: reactive store (state + actions)
useClientSession(): Session | null      // deprecated legacy getter (was useSession)
useAccount(): UseAccountReturn          // reactive { party, account, status, ... }
useWallets(): { wallets, isLoading, error }
useConnect(): { connect, isConnecting, error }
useDisconnect(): { disconnect, isDisconnecting, error }
useSignMessage(): { signMessage, isSigning, error }
useRegistryStatus(): { status, refresh }

// Provider - stable
<PartyLayerProvider client={client}>
  {children}
</PartyLayerProvider>

// Components - stable props
<WalletModal isOpen={boolean} onClose={() => void} onConnect={(sessionId) => void} />
```

### Event Names

These event names are stable and will not be renamed:

| Event | Payload Type |
|-------|--------------|
| `session:connected` | `{ session: Session }` |
| `session:disconnected` | `{ sessionId: SessionId }` |
| `session:expired` | `{ sessionId: SessionId }` |
| `tx:status` | `{ sessionId, txId, status, raw? }` |
| `registry:status` | `{ status: RegistryStatus }` |
| `error` | `{ error: PartyLayerError }` |

### Error Codes

Error codes are stable identifiers for programmatic handling:

| Code | Meaning |
|------|---------|
| `WALLET_NOT_FOUND` | Wallet not in registry |
| `ADAPTER_NOT_REGISTERED` | Discovery-adapter wallet selected with no matching provider adapter registered |
| `WALLET_NOT_INSTALLED` | Wallet extension not detected |
| `USER_REJECTED` | User cancelled operation |
| `SESSION_EXPIRED` | Session has expired |
| `TIMEOUT` | Operation timed out |
| `TRANSPORT_ERROR` | Communication error |
| `ORIGIN_NOT_ALLOWED` | Origin not in allowlist |
| `CAPABILITY_NOT_SUPPORTED` | Wallet lacks capability |
| `REGISTRY_FETCH_FAILED` | Registry fetch error |
| `REGISTRY_VERIFICATION_FAILED` | Signature verification failed |
| `REGISTRY_SCHEMA_INVALID` | Invalid registry format |
| `INTERNAL_ERROR` | Unexpected internal error |
| `NETWORK_MISMATCH` | Wallet is on a different network than the dApp requires |

---

## Extensible API (May Grow)

These APIs may receive new optional fields/methods without breaking existing code:

### Configuration

```typescript
interface PartyLayerConfig {
  // Existing fields stable
  // New optional fields may be added:
  telemetry?: TelemetryAdapter | TelemetryConfig;  // Added in 0.3.0
  // Future optional fields...
}
```

### Adapter Interfaces

```typescript
interface TelemetryAdapter {
  // Required methods - stable
  track(event: string, properties?: Record<string, unknown>): void;
  error(error: Error, properties?: Record<string, unknown>): void;
  
  // Optional methods may be added
  increment?(metric: string, value?: number): void;  // Added in 0.3.0
  gauge?(metric: string, value: number): void;       // Added in 0.3.0
  flush?(): Promise<void>;                           // Added in 0.3.0
}
```

### Event Payloads

Event payloads may receive new optional fields:

```typescript
// Current
{ type: 'session:connected', session: Session }

// Future (backward compatible)
{ type: 'session:connected', session: Session, reason?: 'connect' | 'restore' }
```

---

## Internal API (May Change)

The following are internal and may change without notice:

- Private class methods (prefixed with `_` or `private`)
- Internal utility functions not exported from package index
- Implementation details of adapters
- Build artifacts structure
- Test utilities

---

## Deprecation Process

When deprecating a public API:

1. **Announce** - Release notes mention deprecation
2. **Warn** - Console warning when deprecated API used
3. **Document** - Migration guide provided
4. **Grace Period** - At least 1 minor version
5. **Remove** - Major version removes the API

Example:
```typescript
/**
 * @deprecated Use `connect({ walletId })` instead. Will be removed in 1.0.0.
 */
function connectWallet(walletId: string): Promise<Session> {
  console.warn('connectWallet is deprecated. Use connect({ walletId }) instead.');
  return this.connect({ walletId });
}
```

---

## Migration Guides

Breaking changes will include migration guides in `/docs/migrations/`:

- `docs/migrations/0.2-to-0.3.md`
- `docs/migrations/0.3-to-1.0.md`

---

## Questions?

If you're unsure whether an API is stable, check:
1. Is it exported from the package's main index?
2. Is it documented in the README or API docs?
3. Is it used in the examples?

If yes to all three, it's likely stable. When in doubt, open an issue.
