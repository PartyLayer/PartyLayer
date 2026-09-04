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

Reports what a wallet's presence actually is.

```typescript
detectInstalled(): Promise<AdapterDetectResult>

interface AdapterDetectResult {
  /** @deprecated read `availability` — see below for why this misleads */
  installed: boolean;
  availability?: Availability;
  reason?: string;
}

type Availability =
  | { kind: 'installed' }                     // probed, and present
  | { kind: 'not-installed'; install?: string } // probed, and absent
  | { kind: 'no-local-install' }              // QR / popup / relay: nothing to probe
  | { kind: 'unknown'; reason?: string };     // the probe failed or timed out
```

**Read `availability`, not `installed`.** `installed` remains for source
compatibility and is exactly `availability.kind === 'installed'`.

##### Four of twelve adapters probe anything real

This is the fact the split exists for, and it is easy to forget and then
rediscover as a surprise. Measured from shipped source:

| Adapter | Evidence it probes | Answers |
|---|---|---|
| `console` | postMessage probe to the extension | `installed` / `not-installed` / `unknown` |
| `nightly` | `window.nightly?.canton` | `installed` / `not-installed` |
| `send` | `canton:announceProvider` + `window.canton` | `installed` / `not-installed` |
| `GenericAnnounceAdapter` | presence by construction — it only exists if an announce arrived | `installed` |
| `loop` | **nothing** — QR + WebSocket | `no-local-install` |
| `cantor8` | **nothing** — hosted web wallet | `no-local-install` |
| `bron` | **nothing** — OAuth remote signer | `no-local-install` |
| `walletconnect` | **nothing** — relay | `no-local-install` |
| `walley` (vendor) | `typeof window.open === 'function'` — true in any browser | derived, vendor not called |
| `cauri` (vendor) | `Promise.resolve(true)` | derived, vendor not called |
| `oneswap` (vendor) | `typeof window !== 'undefined'` | derived, vendor not called |
| `GenericDiscoveryAdapter` | derives from `discovery-adapter` transport | `no-local-install` |

The eight that probe nothing are not defective adapters — a QR wallet, a hosted
popup, a relay and an OAuth service have no local artefact to look for. They
previously answered `installed: true`, meaning "reachable", and the picker read
it as "installed". Cantor8 is not an extension at all: its tile said installed,
and clicking it opened a tab.

The three vendor `detect()` implementations are quoted above because they are
constants. `GenericDiscoveryAdapter` therefore does **not** call them and derives
the answer from the registry's `discovery-adapter` transport instead — see
`GenericDiscoveryAdapter.detectInstalled`, which is the single place that rule is
applied.

##### Known mismatch: Cantor8 classifies as `scan` but opens a tab

Cantor8's registry entry carries `installation.scriptTag`, so
`classifyWalletTransport` returns `scan` and the picker's subtitle reads "Scan to
connect". Cantor8 does not present a QR — connecting opens a tab on its hosted
URL. The subtitle is therefore still wrong for this one wallet, in a smaller way
than "installed" was.

This is a **registry-data fix, queued with the D5 / D6 registry work** (the
entries also lack `providerDetection`, and the schema cannot express the
`transfer`, `ledgerApi`, `popup` or `restore` capabilities). Recorded here so it
does not fall between pull requests.

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
// Nightly is auto-registered, no manual setup needed
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
