---
"@partylayer/adapter-console": patch
---

Fix an SSR crash: lazy-load the Console Wallet SDK so importing `@partylayer/adapter-console` on the server no longer eagerly initializes the SDK's localforage storage (which throws "No available storage method found" with no IndexedDB/localStorage).

The static value import of `@console-wallet/dapp-sdk` is replaced by a promise-cached dynamic import (`getConsoleWallet()`) that loads the SDK once, lazily, on first browser use. **Behavior-preserving — no public API change:** `on()` keeps its synchronous `(): () => void` signature (the subscription registers one microtask later via the cached import; events arrive via async postMessage, so none are missed). Fixes the localforage error logged by any SSR consumer (Next.js App Router, the demo).
