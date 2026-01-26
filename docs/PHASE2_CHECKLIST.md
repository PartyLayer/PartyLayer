# Phase 2 Implementation Checklist

## ✅ Completed Tasks

### A) Console Adapter Upgrade
- [x] Refactored to implement `WalletAdapter` interface
- [x] Implemented `walletId` and `name` properties
- [x] Implemented `getCapabilities()` returning correct capabilities
- [x] Implemented robust `detectInstalled()` with clear error messages
- [x] Implemented `connect()` with origin binding
- [x] Implemented `disconnect()`, `signMessage()`, `signTransaction()`, `submitTransaction()`
- [x] Implemented `restore()` returning null (not supported)
- [x] Error mapping using `mapUnknownErrorToCantonConnectError()`
- [x] Uses branded types (`WalletId`, `PartyId`, `SessionId`)
- [x] Compiles with TypeScript strict mode

### B) Loop Adapter Real Integration
- [x] Added `@fivenorth/loop-sdk` dependency
- [x] Implemented `WalletAdapter` interface
- [x] Implemented `detectInstalled()` checking for Loop SDK
- [x] Implemented `connect()` with QR code/popup flow
- [x] Implemented `signMessage()` using Loop provider
- [x] Implemented `submitTransaction()` (Loop combines sign+submit)
- [x] `signTransaction()` throws `CapabilityNotSupportedError`
- [x] Network mapping (devnet/testnet → Loop format)
- [x] Error mapping for all operations
- [x] Created `docs/wallets/loop.md` with install/usage/troubleshooting

### C) Demo App Update
- [x] Updated to use `createCantonConnect()` public API
- [x] Uses `@cantonconnect/react` hooks (`useWallets`, `useSession`, `useConnect`, etc.)
- [x] No internal imports (only public exports)
- [x] Home page: Connect button, session display, sign message
- [x] Debug page: Event log, registry status
- [x] Error display showing error.code and friendly messages
- [x] Installed badge in wallet modal
- [x] Capabilities display
- [x] Session expiry countdown (if applicable)

### D) Documentation
- [x] Created `docs/api.md` - Public API reference
- [x] Created `docs/errors.md` - Error codes table with UX messages
- [x] Created `docs/adapters.md` - Adapter contract summary
- [x] Created `docs/wallets/console.md` - Console integration guide
- [x] Created `docs/wallets/loop.md` - Loop integration guide
- [x] All docs include source references at top

### E) Adapter Compliance Tests
- [x] Created `packages/core/src/adapters.test.ts` - Contract compliance tests
- [x] Created `packages/adapters/console/src/console-adapter.test.ts`
- [x] Created `packages/adapters/loop/src/loop-adapter.test.ts`
- [x] Tests verify:
  - `getCapabilities()` returns `CapabilityKey[]`
  - `detectInstalled()` returns `AdapterDetectResult`
  - `connect()` throws `WALLET_NOT_INSTALLED` when not installed
  - `signTransaction()` throws `CapabilityNotSupportedError` for Loop
  - Error mapping works correctly
- [x] Added Vitest to root and adapter packages
- [x] CI-ready: `pnpm test` runs all tests

## File Changes Summary

### Created Files
- `packages/adapters/console/src/console-adapter.test.ts`
- `packages/adapters/loop/src/loop-adapter.test.ts`
- `packages/core/src/adapters.test.ts`
- `docs/api.md`
- `docs/errors.md`
- `docs/adapters.md`
- `docs/wallets/console.md`
- `docs/wallets/loop.md`
- `apps/demo/src/app/debug/page.tsx`

### Modified Files
- `packages/adapters/console/src/console-adapter.ts` - Complete rewrite
- `packages/adapters/loop/src/loop-adapter.ts` - Complete rewrite
- `packages/adapters/loop/package.json` - Added `@fivenorth/loop-sdk` dependency
- `packages/react/src/context.tsx` - Updated for new API
- `packages/react/src/hooks.ts` - Updated for new API
- `packages/react/src/modal.tsx` - Enhanced UI
- `apps/demo/src/app/page.tsx` - Updated to use `createCantonConnect()`
- `apps/demo/src/app/components/DemoApp.tsx` - Updated for new hooks
- `packages/registry-client/src/client.ts` - Updated to use `WalletInfo`
- `packages/registry-client/src/schema.ts` - Added `registryEntryToWalletInfo()`

## Verification

```bash
# Build all packages
pnpm build
# Expected: All packages build successfully

# Run tests
pnpm test
# Expected: All tests pass

# Run demo
pnpm --filter demo dev
# Expected: Demo app runs and can connect to Console/Loop
```

## Known Limitations

1. **Loop SDK Loading**: Must be loaded before adapter use
2. **Session Restoration**: Not supported by Console or Loop
3. **Registry Channel**: Defaults to 'stable'
4. **Adapter Registration**: Manual via `registerAdapter()`
