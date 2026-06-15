# {{PROJECT_NAME}}

A [PartyLayer](https://partylayer.xyz) dApp — Nuxt 3 + Vue 3 + Pinia, with **SSR session**.

## Develop

```bash
npm run dev
```

## How it's wired

- **Server** ([lib/session.ts](lib/session.ts)) reads the session cookie via Nuxt's SSR-aware `useCookie()`, wrapped as a `CookieAdapter` and fed to `@partylayer/session`'s `createCookieStorage` → the connected party renders in the **initial HTML** (no flash). `app.vue` gates on `getServerSession()`.
- **Client** ([plugins/partylayer.client.ts](plugins/partylayer.client.ts)) creates the PartyLayer client and provides the session store (`createPartyLayerSession`), using `createCookieStorage()` (the same cookie, `document.cookie`).
- **Pinia** ([stores/session.ts](stores/session.ts)) surfaces the PartyLayer session (`isConnected` / `party` / `status` + `connect`/`disconnect`) as a store — components read the store. This is the idiomatic "PartyLayer + Pinia" pattern.
- Nuxt's cookie API is used only in your app (`lib/session.ts`), never in `@partylayer/session` — the library stays framework-agnostic (the same `CookieAdapter` the Next template feeds with `cookies()`).

## Build

```bash
npm run build && npm run preview
```

## Docs

- [PartyLayer docs](https://partylayer.xyz/docs/introduction)
- [@partylayer/vue composables](https://www.npmjs.com/package/@partylayer/vue)
