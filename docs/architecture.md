# CantonConnect Architecture

## Overview

CantonConnect provides a unified SDK for dApps to connect to multiple Canton Network wallets through a single integration. The architecture is designed to be:

- **Modular**: Separate packages for core, SDK, adapters, and React bindings
- **Extensible**: Easy to add new wallet adapters
- **Type-safe**: Full TypeScript support with strict mode
- **Future-proof**: Versioned registry with migration support

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      dApp Application                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         @cantonconnect/react (Hooks/UI)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              @cantonconnect/sdk (Main SDK)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Session Management │ Event System │ Storage         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  @cantonconnect │  │  @cantonconnect │  │  @cantonconnect │
│  /core          │  │  /registry-     │  │  /adapters/*    │
│                 │  │  client        │  │                 │
│  Types          │  │                 │  │  Console        │
│  Errors         │  │  Fetch          │  │  Loop           │
│  Transport      │  │  Cache          │  │  Cantor8        │
│  Session        │  │  Validate       │  │  Bron           │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Wallet Registry│
                    │   (Remote JSON)│
                    └───────────────┘
```

## Package Structure

### `@cantonconnect/core`

Core types, errors, and abstractions used across all packages.

**Key Exports:**
- `types.ts`: Core TypeScript types (PartyId, Session, WalletMetadata, etc.)
- `errors.ts`: Error classes for different failure scenarios
- `adapter.ts`: WalletAdapter interface contract
- `transport.ts`: Transport abstractions for wallet communication
- `session.ts`: Session management utilities

### `@cantonconnect/registry-client`

Client for fetching and caching the wallet registry.

**Features:**
- Fetches registry from remote URL
- Validates registry schema
- Caches registry with TTL
- Converts registry entries to WalletMetadata

### `@cantonconnect/sdk`

Main SDK implementation that orchestrates wallet connections.

**Features:**
- Wallet adapter registration
- Session management with encrypted storage
- Event system for connect/disconnect/transaction updates
- Connection, signing, and transaction submission flows

### `@cantonconnect/adapters/*`

Wallet-specific adapter implementations.

Each adapter implements the `WalletAdapter` interface:
- `connect()`: Establish connection to wallet
- `disconnect()`: Close connection
- `signMessage()`: Sign arbitrary messages
- `signTransaction()`: Sign DAML transactions
- `submitTransaction()`: Submit signed transactions
- `restoreSession()`: Restore existing session (if supported)

### `@cantonconnect/react`

React hooks and components for easy integration.

**Exports:**
- `CantonConnectProvider`: Context provider
- `useCantonConnect()`: Access SDK instance
- `useWallets()`: Get available wallets
- `useSessions()`: Get active sessions
- `useConnect()`: Connect hook
- `useDisconnect()`: Disconnect hook
- `useSignMessage()`: Sign message hook
- `WalletModal`: Wallet selection modal component

## Sequence Diagrams

### Connect Flow

```
dApp                    SDK                  Adapter              Wallet
 │                      │                     │                    │
 │  connect(walletId)   │                     │                    │
 ├─────────────────────>│                     │                    │
 │                      │  connect(options)   │                    │
 │                      ├─────────────────────>│                    │
 │                      │                     │  connect()         │
 │                      │                     ├───────────────────>│
 │                      │                     │  [User Approval]   │
 │                      │                     │<───────────────────│
 │                      │  {session, wallet}  │                    │
 │                      │<─────────────────────│                    │
 │  {session, wallet}   │                     │                    │
 │<─────────────────────│                     │                    │
 │                      │  storeSession()     │                    │
 │                      ├─────────────────────>│                    │
 │                      │  emit('connect')     │                    │
 │                      ├─────────────────────>│                    │
```

### Sign Transaction Flow

```
dApp                    SDK                  Adapter              Wallet
 │                      │                     │                    │
 │  signTransaction()   │                     │                    │
 ├─────────────────────>│                     │                    │
 │                      │  signTransaction()  │                    │
 │                      ├─────────────────────>│                    │
 │                      │                     │  signTransaction() │
 │                      │                     ├───────────────────>│
 │                      │                     │  [User Approval]   │
 │                      │                     │<───────────────────│
 │                      │  {signedTx, hash}   │                    │
 │                      │<─────────────────────│                    │
 │  {signedTx, hash}    │                     │                    │
 │<─────────────────────│                     │                    │
```

### Session Restore Flow

```
SDK                    Storage              Adapter
 │                      │                     │
 │  getAllSessions()    │                     │
 ├─────────────────────>│                     │
 │  [sessions]          │                     │
 │<─────────────────────│                     │
 │                      │                     │
 │  restoreSession()    │                     │
 ├───────────────────────────────────────────>│
 │                      │  validateSession()  │
 │                      │<────────────────────│
 │  true/false          │                     │
 │<───────────────────────────────────────────│
 │                      │                     │
 │  if (!restored)      │                     │
 │    removeSession()   │                     │
 ├─────────────────────>│                     │
```

## Security Considerations

### Origin Binding

Sessions are bound to the origin (domain) that created them. This prevents:
- Session hijacking across domains
- Cross-site request forgery (CSRF)

### Encrypted Storage

Session metadata is encrypted using Web Crypto API before storage:
- Uses AES-GCM encryption
- Key derived from origin (deterministic)
- Fallback to base64 encoding if Web Crypto unavailable

### Explicit Consent

All wallet operations require explicit user consent:
- Connection requests show app name and requested permissions
- Signing operations display the payload to be signed
- Transaction submissions show transaction details

### Safe Payload Display

The SDK provides utilities for safely displaying:
- Party IDs
- Transaction hashes
- Signing payloads (with truncation for long content)

## Registry Schema

The wallet registry is a versioned JSON document:

```json
{
  "metadata": {
    "version": "1.0.0",
    "schemaVersion": "1.0.0",
    "timestamp": 1234567890,
    "publisher": "CantonConnect",
    "previousVersion": "0.9.0"
  },
  "wallets": [
    {
      "id": "console",
      "name": "Console Wallet",
      "description": "Official Console Wallet",
      "homepage": "https://console.digitalasset.com",
      "icon": "https://...",
      "supportedNetworks": ["mainnet", "devnet", "local"],
      "capabilities": {
        "signMessage": true,
        "signTransaction": true,
        "submitTransaction": true,
        "transactionStatus": true,
        "switchNetwork": true,
        "multiParty": false
      },
      "adapter": {
        "type": "console",
        "config": {}
      },
      "installation": {
        "windowProperty": "consoleWallet"
      }
    }
  ],
  "signature": {
    "algorithm": "ed25519",
    "signature": "...",
    "publicKey": "..."
  }
}
```

## Error Handling

The SDK uses typed error classes:

- `WalletNotFoundError`: Wallet not in registry
- `WalletNotInstalledError`: Wallet not installed in browser
- `ConnectionRejectedError`: User rejected connection
- `SessionExpiredError`: Session has expired
- `UserRejectedError`: User rejected signing operation
- `TransportError`: Communication error with wallet
- `TimeoutError`: Operation timed out

## Event System

Events are emitted for:
- `connect`: New wallet connection
- `disconnect`: Wallet disconnected
- `sessionExpired`: Session expired
- `transactionUpdate`: Transaction status update
- `networkChanged`: Network switched
- `partyChanged`: Active party changed

## Future Enhancements

- Multi-party support (multiple parties per session)
- Transaction batching
- Offline transaction preparation
- Enhanced telemetry (opt-in)
- Wallet discovery via browser extensions
- Mobile wallet support via deep links
