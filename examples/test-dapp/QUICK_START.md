# Quick Start Guide

## Prerequisites

1. **Registry Server Running**
   ```bash
   # From wallet-sdk root
   cd apps/registry-server
   pnpm build
   pnpm start
   ```
   Server runs on `http://localhost:3001`

2. **Install Dependencies**
   ```bash
   # From wallet-sdk root
   cd examples/test-dapp
   pnpm install
   ```

## Run the App

```bash
pnpm dev
```

Open http://localhost:5173

## What You Should See

1. **App loads** - Header "CantonConnect Test DApp"
2. **Registry Status Panel** - Shows:
   - Channel: `stable`
   - Verified: `✓ Verified`
   - Source: `Network` (or `Cache` if offline)
   - Sequence: number
3. **Connect Wallet Button** - Click to open wallet modal
4. **Wallet Modal** - Shows list of wallets from registry
5. **Session Info Panel** - Shows "Not connected" initially
6. **Event Log** - Empty initially, fills as events occur

## Testing Scenarios

### Scenario 1: Connect Console Wallet (if installed)
1. Click "Connect Wallet"
2. Click "Console" wallet
3. Approve connection in wallet
4. Session info shows: walletId, partyId, capabilities
5. Event log shows: `session:connected` event

### Scenario 2: Wallet Not Installed
1. Click "Connect Wallet"
2. Click uninstalled wallet (e.g., Loop if not installed)
3. Error panel shows: `WALLET_NOT_INSTALLED`
4. Error code and message displayed

### Scenario 3: Session Restore
1. Connect Console wallet
2. Refresh page (F5)
3. Session persists (if Console supports restore)
4. Session info shows `restoreReason: "restore"`

### Scenario 4: Registry Offline
1. Stop registry server (Ctrl+C)
2. Registry status updates to `Cache`
3. App continues working with cached registry
4. Restart registry server
5. Registry status updates back to `Network`

## Troubleshooting

**Error: "Failed to fetch registry"**
- Ensure registry server is running on port 3001
- Check `.env` file has correct `VITE_REGISTRY_URL`

**Error: "CORS error"**
- Registry server should allow `localhost:5173` origin
- Check registry server CORS configuration

**No wallets showing**
- Check registry server is serving wallets
- Check browser console for errors
- Verify registry.json has wallet entries

**Session not restoring**
- Console wallet supports restore
- Loop wallet requires reconnect
- Check browser storage is enabled

## Next Steps

- Add sign message functionality
- Add transaction signing
- Customize UI styling
- Add network switching
- Add channel switching (stable/beta)
