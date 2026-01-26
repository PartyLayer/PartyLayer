# Wallet Adapter Contract

**References:**
- [OpenRPC dApp API spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

This document describes the contract that all wallet adapters must implement.

## WalletAdapter Interface

All adapters must implement the `WalletAdapter` interface from `@cantonconnect/core`.

### Required Properties

- `walletId: WalletId` - Unique wallet identifier
- `name: string` - Display name

### Required Methods

#### getCapabilities()

Returns array of supported capabilities.

```typescript
getCapabilities(): CapabilityKey[]
```

#### detectInstalled()

Detects if wallet is installed/available.

```typescript
detectInstalled(): Promise<AdapterDetectResult>
```

#### connect()

Establishes connection to wallet.

```typescript
connect(
  ctx: AdapterContext,
  opts?: { timeoutMs?: number; partyId?: PartyId }
): Promise<AdapterConnectResult>
```

#### disconnect()

Disconnects from wallet.

```typescript
disconnect(ctx: AdapterContext, session: Session): Promise<void>
```

### Optional Methods

These should only be implemented if the wallet supports them:

- `restore()` - Restore session (if supported)
- `signMessage()` - Sign arbitrary messages
- `signTransaction()` - Sign transactions
- `submitTransaction()` - Submit transactions
- `on()` - Subscribe to adapter events

## AdapterContext

Provided to all adapter methods:

```typescript
interface AdapterContext {
  appName: string;
  origin: string;
  network: NetworkId;
  logger: LoggerAdapter;
  telemetry?: TelemetryAdapter;
  registry: RegistryClientAdapter;
  crypto: CryptoAdapter;
  storage: StorageAdapter;
  timeout: (ms: number) => Promise<never>;
  abortSignal?: AbortSignal;
}
```

## Error Mapping

All external errors must be mapped using:

```typescript
import { mapUnknownErrorToCantonConnectError } from '@cantonconnect/core';

try {
  // Wallet SDK call
} catch (err) {
  throw mapUnknownErrorToCantonConnectError(err, {
    walletId: this.walletId,
    phase: 'connect', // or 'signMessage', 'signTransaction', etc.
    transport: 'injected', // or 'popup', 'deeplink', 'remote'
  });
}
```

## Capability Guards

Use helper functions to check capabilities:

```typescript
import { capabilityGuard, installGuard } from '@cantonconnect/core';

// Check installation
await installGuard(adapter);

// Check capabilities
capabilityGuard(adapter, ['signMessage', 'signTransaction']);
```

## See Also

- [Console Wallet Adapter Guide](./wallets/console.md)
- [Loop Wallet Adapter Guide](./wallets/loop.md)
