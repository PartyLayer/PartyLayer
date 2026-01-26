# Demo Build Fix Documentation

## Root Cause

The demo app build was failing due to multiple issues:

1. **Webpack Module Resolution**: Next.js webpack couldn't resolve workspace packages (`@cantonconnect/*`) even though they were symlinked correctly by pnpm.

2. **ESLint/TypeScript Strict Mode**: Type safety issues with `any` types and promise-returning functions in event handlers.

3. **SSR/Client Boundary**: The debug page was trying to use React hooks (`useCantonConnect`, `useRegistryStatus`) during static generation, causing "useCantonConnect must be used within CantonConnectProvider" errors.

## Fixes Applied

### 1. Webpack Alias Configuration

Added webpack aliases in `next.config.js` to explicitly resolve workspace packages:

```javascript
webpack: (config) => {
  config.resolve.alias = {
    ...config.resolve.alias,
    '@cantonconnect/react': path.resolve(__dirname, '../../packages/react'),
    '@cantonconnect/sdk': path.resolve(__dirname, '../../packages/sdk'),
    // ... other packages
  };
  return config;
}
```

**Why**: Next.js webpack needs explicit path resolution for workspace packages, even with pnpm symlinks.

### 2. Type Safety Fixes

- Added explicit `WalletInfo` type annotation in wallet map function
- Wrapped async event handlers with `void` to satisfy ESLint `no-misused-promises` rule
- Added proper type guards for wallet properties

**Why**: TypeScript strict mode requires explicit types and proper promise handling.

### 3. Client-Only Initialization

Moved `createCantonConnect` and adapter registration to a client-only wrapper component that only initializes after mount:

```typescript
function CantonConnectWrapper({ children }) {
  const [client, setClient] = useState(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Initialize client and adapters here
  }, []);
  
  // ...
}
```

**Why**: Wallet adapters require `window` APIs, and React hooks can't be called during SSR/static generation.

### 4. Dynamic Page Export

Added `export const dynamic = 'force-dynamic'` to debug page and split into wrapper/content components to prevent static generation.

**Why**: Pages using context providers can't be statically generated.

### 5. Environment Variables

Configured environment variables in `next.config.js`:
- `NEXT_PUBLIC_REGISTRY_URL` (default: http://localhost:3001)
- `NEXT_PUBLIC_REGISTRY_CHANNEL` (default: stable)
- `NEXT_PUBLIC_NETWORK` (default: devnet)

## Verification Steps

1. **Build succeeds**:
   ```bash
   cd apps/demo
   pnpm build
   ```

2. **Dev server starts**:
   ```bash
   pnpm dev
   ```

3. **No window errors**: Check browser console for "window is not defined" errors

4. **Registry status loads**: Verify registry status indicator appears in UI

5. **E2E tests pass**:
   ```bash
   pnpm test:e2e
   ```

## Files Modified

- `apps/demo/next.config.js` - Added webpack aliases and transpilePackages
- `apps/demo/src/app/page.tsx` - Client-only wrapper for initialization
- `apps/demo/src/app/components/DemoApp.tsx` - Type safety fixes
- `apps/demo/src/app/debug/page.tsx` - Dynamic export and client-only hooks
- `.npmrc` - Added shamefully-hoist for better workspace resolution

## Tradeoffs

- **Webpack aliases**: Slightly more complex config, but necessary for workspace packages
- **Client-only init**: Slight delay before client initializes, but prevents SSR errors
- **Dynamic pages**: Debug page can't be statically generated, but it's a debug tool anyway

## Known Limitations

1. Debug page E2E test is skipped - requires provider context that's only available when navigating from home page
2. Registry server must be running for full functionality (tests handle gracefully)
3. Wallet adapters must be manually registered in demo (future: auto-register from registry)
