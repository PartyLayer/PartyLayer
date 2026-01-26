# CantonConnect API Reference

**References:**
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Signing transactions from dApps](https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html)
- [OpenRPC dApp API spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)

## createCantonConnect

Creates a new CantonConnect client instance.

```typescript
function createCantonConnect(config: CantonConnectConfig): CantonConnectClient
```

### Configuration

```typescript
interface CantonConnectConfig {
  registryUrl: string;
  channel?: 'stable' | 'beta';
  network: NetworkId;
  storage?: StorageAdapter;
  crypto?: CryptoAdapter;
  registryPublicKeys?: string[];
  telemetry?: TelemetryAdapter;
  logger?: LoggerAdapter;
  app: {
    name: string;
    origin?: string;
  };
}
```

## CantonConnectClient

Main client interface for interacting with Canton wallets.

### Methods

#### listWallets

List available wallets from registry.

```typescript
listWallets(filter?: WalletFilter): Promise<WalletInfo[]>
```

#### connect

Connect to a wallet.

```typescript
connect(options?: ConnectOptions): Promise<Session>
```

#### disconnect

Disconnect from the active wallet.

```typescript
disconnect(): Promise<void>
```

#### getActiveSession

Get the current active session.

```typescript
getActiveSession(): Promise<Session | null>
```

#### signMessage

Sign an arbitrary message.

```typescript
signMessage(params: SignMessageParams): Promise<SignedMessage>
```

#### signTransaction

Sign a transaction.

```typescript
signTransaction(params: SignTransactionParams): Promise<SignedTransaction>
```

#### submitTransaction

Submit a signed transaction.

```typescript
submitTransaction(params: SubmitTransactionParams): Promise<TxReceipt>
```

#### on

Subscribe to events.

```typescript
on<T extends CantonConnectEvent>(
  event: T['type'],
  handler: EventHandler<T>
): () => void
```

#### off

Unsubscribe from events.

```typescript
off<T extends CantonConnectEvent>(
  event: T['type'],
  handler: EventHandler<T>
): void
```

#### destroy

Clean up client and remove all event listeners.

```typescript
destroy(): void
```

## Events

- `registry:updated` - Registry was updated
- `session:connected` - Session connected
- `session:disconnected` - Session disconnected
- `session:expired` - Session expired
- `tx:status` - Transaction status update
- `error` - Error occurred

## Types

See [Quick Start Guide](./quick-start.md) for usage examples.
