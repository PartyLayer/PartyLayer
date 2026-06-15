---
"create-partylayer-app": minor
---

Add the **vanilla** template — plain TypeScript + Vite, no framework. Completes the four-template set (react-vite, next-ssr, vue-nuxt-pinia, vanilla).

Uses the `@partylayer/sdk` client API directly: `createPartyLayer(...)` → `client.listWallets()` lists the verified registry wallets → `client.connect({ walletId })` → `client.on('session:connected'|'session:disconnected')` + `client.getActiveSession()`. A hand-rolled DOM connect UI — no React/Vue, no provider package (the SDK client is the dApp's surface).
