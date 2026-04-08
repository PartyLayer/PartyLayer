# Wallet Adapter Contract

**References:**
- [OpenRPC dApp API spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)

This document describes the contract that all wallet adapters must implement.

## WalletAdapter Interface

All adapters must implement the `WalletAdapter` interface from `@partylayer/core`.

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
import { mapUnknownErrorToPartyLayerError } from '@partylayer/core';

try {
  // Wallet SDK call
} catch (err) {
  throw mapUnknownErrorToPartyLayerError(err, {
    walletId: this.walletId,
    phase: 'connect', // or 'signMessage', 'signTransaction', etc.
    transport: 'injected', // or 'popup', 'deeplink', 'remote'
  });
}
```

## Capability Guards

Use helper functions to check capabilities:

```typescript
import { capabilityGuard, installGuard } from '@partylayer/core';

// Check installation
await installGuard(adapter);

// Check capabilities
capabilityGuard(adapter, ['signMessage', 'signTransaction']);
```

## Built-in Adapters

The SDK ships with 5 wallet adapters. Four are auto-registered via `getBuiltinAdapters()`:

| Adapter | Wallet | Transport | Auto-registered |
|---------|--------|-----------|-----------------|
| `ConsoleAdapter` | Console Wallet | PostMessage / QR / Deep Link | Yes |
| `LoopAdapter` | 5N Loop | QR Code / Popup | Yes |
| `Cantor8Adapter` | Cantor8 | Deep Link | Yes |
| `NightlyAdapter` | Nightly | Injected (`window.nightly.canton`) | Yes |
| `BronAdapter` | Bron | OAuth2 / API | No (requires config) |

### Nightly Adapter

The Nightly adapter integrates with [Nightly Wallet](https://nightly.app), a multichain wallet with native Canton Network support.

**Detection:**
```typescript
// Checks for injected provider
window.nightly?.canton // NightlyCantonProvider
```

**Capabilities:** `connect`, `disconnect`, `restore`, `signMessage`, `submitTransaction`, `events`, `injected`

**Key differences from other adapters:**
- **Callback-based signing**: Nightly's `signMessage()` and `submitTransactionCommand()` use callbacks instead of Promises. The adapter wraps these in Promises internally.
- **Combined sign+submit**: There is no separate `signTransaction()`. The adapter uses `createTransferCommand()` + `submitTransactionCommand()` for transaction submission.
- **Session restoration**: Uses `isConnected()` to check if a previous session is still valid.

```typescript
// Nightly is auto-registered — no manual setup needed
const client = createPartyLayer({
  network: 'devnet',
  app: { name: 'My dApp' },
});

// Nightly appears in wallet list if extension is installed
const wallets = await client.listWallets();
```

## See Also

- [Console Wallet Adapter Guide](./wallets/console.md)
- [Loop Wallet Adapter Guide](./wallets/loop.md)
