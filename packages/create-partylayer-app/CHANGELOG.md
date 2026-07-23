# create-partylayer-app

## 0.5.0

### Minor Changes

- Two new scaffold templates: react-tokenization (CIP-0056 holdings, transfers, and issuance over a typed demo backend) and react-dvp (atomic delivery versus payment over CIP-0056 allocations), both extracted from the validated vertical examples and pinned to the published @partylayer/react 2.2.1 surface. Both are reference quality, not production audited.

## 0.4.1

### Patch Changes

- Refresh the scaffold template package pins to the current release so a newly scaffolded app installs the latest PartyLayer packages.

## 0.4.0

### Minor Changes

- 9ca71bf: Add the **vanilla** template — plain TypeScript + Vite, no framework. Completes the four-template set (react-vite, next-ssr, vue-nuxt-pinia, vanilla).

  Uses the `@partylayer/sdk` client API directly: `createPartyLayer(...)` → `client.listWallets()` lists the verified registry wallets → `client.connect({ walletId })` → `client.on('session:connected'|'session:disconnected')` + `client.getActiveSession()`. A hand-rolled DOM connect UI — no React/Vue, no provider package (the SDK client is the dApp's surface).

## 0.3.0

### Minor Changes

- b562fd9: Add the **vue-nuxt-pinia** template — Nuxt 3 + Vue 3 + Pinia with server-side session rendering.

  A Server-rendered page reads the session cookie via Nuxt's SSR-aware `useCookie()`, wrapped as a `CookieAdapter` and fed to `@partylayer/session`'s `createCookieStorage` — the connected party renders in the initial HTML (no flash), the same primitive the Next template feeds with `next/headers` `cookies()`. The PartyLayer session is surfaced as a **Pinia store** (`isConnected`/`party`/`status` + `connect`/`disconnect`), the idiomatic "PartyLayer + Pinia" pattern. Nuxt's cookie API stays in the app, never in `@partylayer/session`.

  `create-partylayer-app` now offers three templates: `react-vite`, `next-ssr`, and `vue-nuxt-pinia`.

## 0.2.0

### Minor Changes

- d09209f: Add the **next-ssr** template — Next.js App Router with server-side session rendering.

  A Server Component reads the session cookie (`next/headers` `cookies()` + `@partylayer/session`'s `createCookieStorage@^1.1.0`) and renders the connected party in the initial HTML — no disconnected→connected flash. The client wraps the app in `PartyLayerKit` with `sessionOptions={{ storage: createCookieStorage() }}` (the same cookie, read synchronously). `next/headers` is imported only in the scaffolded app, never in `@partylayer/session`.

  `create-partylayer-app` now offers two templates: `react-vite` and `next-ssr`.

## 0.1.1

### Patch Changes

- Fix the broken 0.1.0 publish: the tarball shipped without `dist/`, so the `bin` target was missing and `npm create partylayer-app` failed with exit 127.

  Root cause: `tsc` inherits `composite`/`incremental` from the root tsconfig, and `clean` only removed `dist/` (not `tsconfig.tsbuildinfo`). A stale buildinfo made `tsc` skip emit, so a publish from that state produced an empty `dist/`. Fix: `clean` now also wipes `*.tsbuildinfo`, and a `prepublishOnly: "pnpm run clean && pnpm run build"` guard guarantees a fresh `dist/` in every tarball. Verified: a dry-run publish from the exact broken state now packs `dist/index.js`.

## 0.1.0

### Minor Changes

- 25e8345: Initial release of `create-partylayer-app` — the PartyLayer dApp scaffolder.

  `npm create partylayer-app@latest` (also `pnpm`/`yarn create`) spins up a working Canton dApp. Ships the **react-vite** template: React 18 + Vite + zero-config `PartyLayerKit` + `ConnectButton`, wired to connect any registry-verified wallet. Interactive prompts (project dir → template → package manager) with non-interactive flags (`--template`, `--pm`, `--no-install`, `--no-git`) for CI.
