# CantonConnect Baseline Status

**Date**: 2026-01-25  
**Status**: Scaffold Complete, Production MVP In Progress

## What Works Today

### ✅ Build System
- **pnpm workspace** configured and working
- All packages compile with TypeScript strict mode
- ESM and CommonJS builds configured

### ✅ Core Packages
- `@cantonconnect/core`: Types, errors, transport abstractions, session utilities
- `@cantonconnect/registry-client`: Registry fetching, caching, validation
- `@cantonconnect/sdk`: Main SDK with session management
- `@cantonconnect/react`: React hooks and provider

### ✅ Wallet Adapters (Structure)
- `@cantonconnect/adapter-console`: Basic implementation (needs hardening)
- `@cantonconnect/adapter-loop`: Skeleton (needs real integration)
- `@cantonconnect/adapter-cantor8`: Skeleton (placeholder)
- `@cantonconnect/adapter-bron`: Skeleton (placeholder)

### ✅ Demo App
- Next.js app structure in place
- Basic UI components
- Can import and use SDK

## What Is Stubbed

### ⚠️ Console Adapter
- Basic connect/sign flows implemented but:
  - Install detection may have false positives
  - Error mapping incomplete
  - Event handling not fully implemented
  - Origin binding not enforced
  - No session restoration

### ⚠️ Loop Adapter
- Placeholder implementation only
- `getLoopSDK()` throws "not available"
- All methods throw "Not implemented"
- No real Loop SDK integration

### ⚠️ Registry
- Basic schema exists
- No signature verification
- No channel support (stable/beta)
- No rollback mechanism
- No offline fallback

### ⚠️ Testing
- Basic unit tests for core utilities
- No adapter contract tests
- No integration tests
- No E2E tests

### ⚠️ Demo App
- Basic UI only
- No wallet modal polish
- No error display
- No session state management
- No debug page

## Known Gaps

1. **Public API**: Not finalized - current API is internal-focused
2. **Error Taxonomy**: Errors exist but not all cases covered
3. **Capabilities**: Not properly exposed/checked
4. **Transport**: PostMessageTransport exists but not used consistently
5. **Session Storage**: Encryption exists but not tested thoroughly
6. **Registry Security**: No signature verification
7. **Adapter Compliance**: No test harness
8. **Documentation**: Missing wallet-specific docs

## Exact Commands

### Install Dependencies
```bash
pnpm install
```
**Status**: ✅ Works

### Build All Packages
```bash
pnpm build
```
**Status**: ✅ Works (packages build successfully, demo app build fails but that's expected - needs Next.js setup)

### Run Tests
```bash
pnpm test
```
**Status**: ⚠️ Needs vitest setup (package.json has test script but vitest not installed in root)

### Type Check
```bash
pnpm typecheck
```
**Status**: ✅ Works

### Lint
```bash
pnpm lint
```
**Status**: ✅ Works

### Run Demo App
```bash
pnpm --filter demo dev
```
**Status**: ⚠️ Not tested yet (needs Next.js dependencies)

### Clean Build Artifacts
```bash
pnpm clean
```
**Status**: ✅ Works

## Next Steps (MVP Phases)

1. **Phase 1**: Finalize public API and types
2. **Phase 2**: Real Loop adapter integration
3. **Phase 3**: Harden Console adapter
4. **Phase 4**: Signed registry with channels/rollback
5. **Phase 5**: Adapter compliance test kit
6. **Phase 6**: Demo app polish

## References

- [Digital Asset Wallet Integration Guide](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Loop SDK](https://github.com/fivenorth-io/loop-sdk)
- [Console DApp SDK](https://www.npmjs.com/package/@console-wallet/dapp-sdk)
- [OpenRPC dApp API Spec](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/api-specs/openrpc-dapp-api.json)
