# PartyLayer API Reference

**References:**
- [Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Signing transactions from dApps](https://docs.digitalasset.com/integrate/devnet/signing-transactions-from-dapps/index.html)
- [OpenRPC dApp API spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)

---

## createPartyLayer

Creates a new PartyLayer client instance.

```typescript
function createPartyLayer(config: PartyLayerConfig): PartyLayerClient
```

### Configuration

```typescript
interface PartyLayerConfig {
  /** Target network */
  network: 'devnet' | 'testnet' | 'mainnet';
  /** Application info shown to wallets */
  app: {
    name: string;
    origin?: string; // defaults to window.location.origin
  };
  /** Registry URL (default: https://registry.partylayer.xyz/v1/wallets.json) */
  registryUrl?: string;
  /** Registry channel (default: 'stable') */
  channel?: 'stable' | 'beta';
  /** Custom storage adapter (default: localStorage) */
  storage?: StorageAdapter;
  /** Custom crypto adapter */
  crypto?: CryptoAdapter;
  /** Registry public keys for signature verification */
  registryPublicKeys?: string[];
  /** Wallet adapters (default: all built-in — Console, Loop, Cantor8, Nightly) */
  adapters?: (WalletAdapter | AdapterClass)[];
  /** Telemetry configuration or custom adapter */
  telemetry?: TelemetryConfig | TelemetryAdapter;
  /** Custom logger */
  logger?: LoggerAdapter;
}
```

---

## PartyLayerClient

Main client interface for interacting with Canton wallets.

### Methods

#### listWallets

List available wallets from registry and registered adapters.

```typescript
listWallets(filter?: WalletFilter): Promise<WalletInfo[]>
```

**Resilience behavior**: If the registry is unreachable, falls back to generating `WalletInfo` from registered adapters. Adapters that are not in the registry are automatically merged into the results.

#### connect

Connect to a wallet.

```typescript
connect(options?: ConnectOptions): Promise<Session>
```

```typescript
interface ConnectOptions {
  walletId?: WalletId;
}
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

#### registerAdapter

Register a custom wallet adapter at runtime.

```typescript
registerAdapter(adapter: WalletAdapter): void
```

#### asProvider

Get a CIP-0103 compliant Provider that wraps this client.

```typescript
asProvider(): CIP0103Provider
```

Returns a Provider that routes all `request()` calls through the client's session and adapter. Supports all 10 mandatory CIP-0103 methods. See [CIP-0103 Compliance](../README.md#cip-0103-canton-dapp-standard-compliance) for details.

#### on / off

Subscribe to and unsubscribe from events.

```typescript
on<T extends PartyLayerEvent>(event: T['type'], handler: EventHandler<T>): () => void
off<T extends PartyLayerEvent>(event: T['type'], handler: EventHandler<T>): void
```

#### destroy

Clean up client resources, flush telemetry, and remove all event listeners.

```typescript
destroy(): void
```

---

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session:connected` | `{ session: Session }` | Wallet connected successfully |
| `session:disconnected` | `{}` | Wallet disconnected |
| `session:expired` | `{}` | Session has expired |
| `tx:status` | `{ txHash, status }` | Transaction status update |
| `registry:status` | `{ status: RegistryStatus }` | Registry status change |
| `error` | `{ error: Error }` | Error occurred |

---

## React Components

### PartyLayerKit

Zero-config wrapper that creates the SDK client, registers adapters, discovers native wallets, and provides theming.

```tsx
import { PartyLayerKit } from '@partylayer/react';

<PartyLayerKit
  network="devnet"
  appName="My dApp"
  theme="auto"
  walletIcons={{ console: '/icons/console.svg' }}
>
  {children}
</PartyLayerKit>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `network` | `'devnet' \| 'testnet' \| 'mainnet'` | — | Target network (required) |
| `appName` | `string` | — | App name shown to wallets (required) |
| `children` | `ReactNode` | — | Child components (required) |
| `registryUrl` | `string` | `https://registry.partylayer.xyz` | Registry URL override |
| `channel` | `'stable' \| 'beta'` | `'stable'` | Registry channel |
| `adapters` | `(WalletAdapter \| AdapterClass)[]` | Built-in adapters | Custom adapters |
| `theme` | `'light' \| 'dark' \| 'auto' \| PartyLayerTheme` | `'light'` | Theme preset or custom theme |
| `walletIcons` | `Record<string, string>` | `{}` | Custom wallet icon URLs by walletId |

### ConnectButton

Polished connect button with wallet modal and connected state dropdown.

```tsx
import { ConnectButton } from '@partylayer/react';

<ConnectButton />
<ConnectButton label="Sign In" showDisconnect={false} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `"Connect Wallet"` | Button label when disconnected |
| `connectedLabel` | `'address' \| 'wallet' \| 'custom'` | `'address'` | What to show when connected |
| `formatAddress` | `(partyId: string) => string` | — | Custom address formatter |
| `className` | `string` | — | CSS class |
| `style` | `CSSProperties` | — | Inline styles |
| `showDisconnect` | `boolean` | `true` | Show disconnect in dropdown |

**States:**
- **Disconnected**: Brand yellow button, opens WalletModal on click
- **Connecting**: Disabled with spinner animation
- **Connected**: Compact button showing truncated party ID, dropdown with disconnect

### WalletModal

Multi-state wallet selection modal with CIP-0103 native wallet priority.

```tsx
import { WalletModal } from '@partylayer/react';

<WalletModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConnect={(sessionId) => console.log('Connected:', sessionId)}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the modal is visible |
| `onClose` | `() => void` | Called when modal should close |
| `onConnect` | `(sessionId: string) => void` | Called after successful connection |
| `walletIcons` | `Record<string, string>` | Additional wallet icon overrides |

**Views:**
- **list** — Wallet selection. CIP-0103 native wallets displayed first with indigo highlight, registry wallets below
- **connecting** — Animated spinner with "Opening {WalletName}"
- **success** — Green checkmark, auto-closes after 800ms
- **error** — Red error badge with retry/back buttons
- **not-installed** — Orange download badge with install link and retry

---

## React Hooks

### usePartyLayer

Access the SDK client instance directly.

```typescript
function usePartyLayer(): PartyLayerClient
```

### useSession

Get the current active session. Returns `null` when disconnected.

```typescript
function useSession(): Session | null
```

### useWallets

Get available wallets (registry + discovered native CIP-0103).

```typescript
function useWallets(): {
  wallets: WalletInfo[];
  isLoading: boolean;
  error: Error | null;
}
```

### useConnect

Connect to a wallet with loading and error state.

```typescript
function useConnect(): {
  connect: (options?: ConnectOptions) => Promise<Session | null>;
  isConnecting: boolean;
  error: Error | null;
  reset: () => void;
}
```

### useDisconnect

Disconnect from the current wallet.

```typescript
function useDisconnect(): {
  disconnect: () => Promise<void>;
  isDisconnecting: boolean;
  error: Error | null;
}
```

### useSignMessage

Sign an arbitrary message.

```typescript
function useSignMessage(): {
  signMessage: (params: SignMessageParams) => Promise<SignedMessage | null>;
  isSigning: boolean;
  error: Error | null;
}
```

### useSignTransaction

Sign a transaction.

```typescript
function useSignTransaction(): {
  signTransaction: (params: SignTransactionParams) => Promise<SignedTransaction | null>;
  isSigning: boolean;
  error: Error | null;
}
```

### useSubmitTransaction

Submit a signed transaction.

```typescript
function useSubmitTransaction(): {
  submitTransaction: (params: SubmitTransactionParams) => Promise<TxReceipt | null>;
  isSubmitting: boolean;
  error: Error | null;
}
```

### useRegistryStatus

Get registry health status with manual refresh.

```typescript
function useRegistryStatus(): {
  status: RegistryStatus | null;
  refresh: () => Promise<void>;
}
```

### useWalletIcons

Access wallet icon overrides provided via `PartyLayerKit`.

```typescript
function useWalletIcons(): Record<string, string>
```

### useTheme

Access the current theme. Falls back to `lightTheme` if no `ThemeProvider` present.

```typescript
function useTheme(): PartyLayerTheme
```

---

## Theme System

PartyLayer supports light, dark, and auto themes. Pass a preset string or a custom `PartyLayerTheme` object.

```typescript
interface PartyLayerTheme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;         // Brand color (#FFCC00)
    primaryHover: string;    // Hover variant (#E6B800)
    background: string;      // Page background
    surface: string;         // Card/surface background
    text: string;            // Primary text
    textSecondary: string;   // Secondary text
    border: string;          // Border color
    success: string;         // Success state
    successBg: string;       // Success background
    error: string;           // Error state
    errorBg: string;         // Error background
    warning: string;         // Warning state
    warningBg: string;       // Warning background
    overlay: string;         // Modal backdrop
  };
  borderRadius: string;      // Default: '10px'
  fontFamily: string;        // System font stack
}
```

**Usage:**

```tsx
// Preset
<PartyLayerKit theme="dark" ...>

// Auto (follows OS preference)
<PartyLayerKit theme="auto" ...>

// Custom
<PartyLayerKit theme={{
  mode: 'dark',
  colors: { primary: '#7C3AED', ...darkTheme.colors },
  borderRadius: '16px',
  fontFamily: 'Inter, sans-serif',
}} ...>
```

---

## Telemetry

Opt-in, privacy-safe telemetry for monitoring SDK usage.

```typescript
interface TelemetryConfig {
  /** Enable telemetry (default: false — fully opt-in) */
  enabled: boolean;
  /** Metrics backend URL */
  endpoint?: string;
  /** Sampling rate: 0.0 to 1.0 (default: 1.0) */
  sampleRate?: number;
  /** App identifier (SHA-256 hashed for privacy) */
  appId?: string;
  /** Include origin in metrics (default: false, hashed) */
  includeOrigin?: boolean;
  /** Batch size before flush (default: 10) */
  batchSize?: number;
  /** Auto-flush interval in ms (default: 30000) */
  flushIntervalMs?: number;
  /** Network identifier */
  network?: NetworkId;
}
```

**Metrics tracked:**
- `wallet_connect_attempts` / `wallet_connect_success` — Connection success rate
- `sessions_created` / `sessions_restored` — Session lifecycle
- `registry_fetch` / `registry_cache_hit` / `registry_stale` — Registry health
- `error_*` — Error counts by code

**Privacy guarantees:**
- All telemetry is opt-in (disabled by default)
- App IDs and origins are SHA-256 hashed
- No PII fields allowed in payloads (walletAddress, partyId, email, etc. are forbidden)
- Payload validation prevents accidental PII leaks

---

## Types

### Core Types

```typescript
type NetworkId = 'devnet' | 'testnet' | 'mainnet';
type WalletId = string;
type PartyId = string;

interface Session {
  sessionId: string;
  walletId: WalletId;
  partyId: PartyId;
  expiresAt?: number;
}

interface WalletInfo {
  walletId: WalletId;
  name: string;
  capabilities: CapabilityKey[];
  icons?: { sm?: string; lg?: string };
  website?: string;
  adapter: { packageName: string; versionRange: string };
}
```

See [Quick Start Guide](./quick-start.md) for usage examples.
