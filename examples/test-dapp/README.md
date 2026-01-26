# CantonConnect Test DApp

A minimal but real dApp demonstrating CantonConnect integration using only the public API.

## Features

- ✅ Connect/disconnect wallets
- ✅ Display session info (partyId, walletId, capabilities)
- ✅ Show registry status (verified, channel, cache/network)
- ✅ Error handling with error codes
- ✅ Event log (session, registry, error events)
- ✅ Uses only public API (`@cantonconnect/sdk`, `@cantonconnect/react`)

## Prerequisites

1. **Registry Server Running**
   ```bash
   # From wallet-sdk root
   cd apps/registry-server
   pnpm build
   pnpm start
   ```
   Server runs on `http://localhost:3001`

2. **Wallets (Optional)**
   - Console wallet extension installed (for real testing)
   - Loop wallet extension installed (for real testing)
   - Or use mock mode (Cantor8/Bron simulated)

## Installation

```bash
# From wallet-sdk root
cd examples/test-dapp
pnpm install
```

## Configuration

Edit `.env` file:

```env
VITE_REGISTRY_URL=http://localhost:3001
VITE_REGISTRY_CHANNEL=stable
VITE_NETWORK=devnet
```

## Running

```bash
pnpm dev
```

Open http://localhost:5173

## Manual Verification Steps

### 1. App Loads
- ✅ Page loads without errors
- ✅ "CantonConnect Test DApp" header visible
- ✅ Registry status panel shows "Loading..." then updates

### 2. Registry Status
- ✅ Channel: `stable` (or `beta` if configured)
- ✅ Verified: `✓ Verified` badge
- ✅ Source: `Network` (or `Cache` if offline)
- ✅ Sequence: number (e.g., `1`)
- ✅ Stale: `No` (or `Yes` if cache is old)

### 3. Connect Wallet
- ✅ Click "Connect Wallet" button
- ✅ Wallet modal opens
- ✅ Wallet list appears:
  - Console
  - Loop
  - Cantor8
  - Bron
- ✅ Installed wallets show "Installed" badge (if detected)

### 4. Connect Flow
**If wallet NOT installed:**
- ✅ Click wallet (e.g., Console)
- ✅ Error appears: `WALLET_NOT_INSTALLED`
- ✅ Error panel shows error code and message

**If wallet IS installed:**
- ✅ Click wallet (e.g., Console)
- ✅ Connection succeeds
- ✅ Session info panel shows:
  - Wallet ID: `console`
  - Party ID: `party::...`
  - Network: `devnet`
  - Capabilities: list of capabilities
  - Created At: timestamp
- ✅ Event log shows `session:connected` event

### 5. Session Restore
- ✅ Refresh page (F5)
- ✅ If restore supported (Console):
  - Session persists
  - Session info shows `restoreReason: "restore"`
- ✅ If restore NOT supported (Loop):
  - Session cleared
  - Shows "Not connected"
  - User must reconnect

### 6. Disconnect
- ✅ Click "Disconnect" button
- ✅ Session cleared
- ✅ Session info shows "Not connected"
- ✅ Event log shows `session:disconnected` event

### 7. Offline/Cache Test
- ✅ Stop registry server (`Ctrl+C` in registry-server terminal)
- ✅ Registry status updates:
  - Source: `Cache`
  - Stale: `Yes` (after cache TTL expires)
- ✅ App continues to work with cached registry
- ✅ Restart registry server
- ✅ Registry status updates back to `Network`

### 8. Error Codes
Test various error scenarios:

- **WALLET_NOT_INSTALLED**: Click uninstalled wallet
- **USER_REJECTED**: Start connect, then cancel/reject
- **TIMEOUT**: (Requires transport timeout test)
- **ORIGIN_NOT_ALLOWED**: (Requires origin allowlist test)

## Project Structure

```
test-dapp/
├── src/
│   ├── cantonconnect.ts      # Client initialization
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main app component
│   ├── App.css               # App styles
│   ├── index.css             # Global styles
│   └── components/
│       ├── ConnectButton.tsx  # Connect/disconnect UI
│       ├── SessionInfo.tsx   # Session display
│       ├── RegistryStatus.tsx # Registry status display
│       ├── ErrorPanel.tsx    # Error display
│       └── EventLog.tsx       # Event log display
├── .env                      # Environment config
├── package.json              # Dependencies
├── vite.config.ts           # Vite config
└── tsconfig.json            # TypeScript config
```

## Public API Usage

This dApp uses **only** the public API:

### From `@cantonconnect/sdk`:
- `createCantonConnect()` - Client creation
- `CantonConnectClient` - Client type
- `CantonConnectEvent` - Event types
- `CantonConnectError` - Error types

### From `@cantonconnect/react`:
- `CantonConnectProvider` - React provider
- `useCantonConnect()` - Main hook
- `useSession()` - Session hook
- `useRegistryStatus()` - Registry status hook
- `useDisconnect()` - Disconnect hook
- `WalletModal` - Wallet selection modal

### From `@cantonconnect/adapter-console`:
- `ConsoleAdapter` - Console Wallet adapter

### From `@cantonconnect/adapter-loop`:
- `LoopAdapter` - 5N Loop Wallet adapter

**No internal imports** - everything uses documented public API.

## Integration Example

```typescript
// src/cantonconnect.ts
import { createCantonConnect } from '@cantonconnect/sdk';
import { ConsoleAdapter } from '@cantonconnect/adapter-console';
import { LoopAdapter } from '@cantonconnect/adapter-loop';

export const client = createCantonConnect({
  registryUrl: 'https://registry.cantonconnect.io',
  channel: 'stable',
  network: 'devnet',
  // Register the wallet adapters you want to support
  adapters: [
    new ConsoleAdapter(),  // Browser extension
    new LoopAdapter(),     // QR code / popup
  ],
  app: {
    name: 'My DApp',
  },
});
```

## Common Errors & Debugging

### Error: "Failed to fetch registry"
**Cause:** Registry server not running  
**Fix:** Start registry server (`cd apps/registry-server && pnpm start`)

### Error: "CORS error"
**Cause:** Registry server CORS not configured  
**Fix:** Ensure registry server allows `localhost:5173` origin

### Error: "WALLET_NOT_INSTALLED"
**Cause:** Wallet extension not installed  
**Fix:** Install Console/Loop wallet extension, or use mock mode

### Error: "Module not found: @cantonconnect/sdk"
**Cause:** Packages not installed  
**Fix:** Run `pnpm install` from wallet-sdk root (workspace setup)

### Registry Status: "Not Verified"
**Cause:** Registry signature invalid or missing  
**Fix:** Verify registry signatures: `pnpm registry:verify --channel stable`

### Session Not Restoring
**Cause:** Wallet doesn't support restore, or storage cleared  
**Fix:** Check `restoreReason` in session info. Console supports restore, Loop doesn't.

## Screenshot Description

**Expected UI Layout:**

```
┌─────────────────────────────────────────┐
│     CantonConnect Test DApp            │
│     Minimal integration example         │
└─────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Connect      │  │ Session Info │  │ Registry     │
│ Wallet       │  │              │  │ Status      │
│ [Button]     │  │ walletId     │  │ channel     │
│              │  │ partyId      │  │ verified ✓  │
│              │  │ capabilities │  │ source      │
│              │  │ [Disconnect] │  │ sequence    │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────┐
│ Error Panel (if error)                  │
│ WALLET_NOT_INSTALLED                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Event Log                               │
│ [timestamp] session:connected          │
│ { "walletId": "console", ... }         │
└─────────────────────────────────────────┘
```

## Next Steps

1. **Add Sign Message**: Use `useSignMessage()` hook
2. **Add Transaction Submit**: Use `useSubmitTransaction()` hook
3. **Add Capability Checks**: Check `session.capabilitiesSnapshot`
4. **Add Network Switching**: Switch between devnet/testnet/mainnet
5. **Add Channel Switching**: Switch between stable/beta

## Support

For issues:
1. Check registry server is running
2. Check `.env` configuration
3. Check browser console for errors
4. Verify wallet extensions installed (if testing real wallets)
5. Review event log for detailed event information
