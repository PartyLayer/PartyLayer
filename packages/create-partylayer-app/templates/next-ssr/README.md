# {{PROJECT_NAME}}

A [PartyLayer](https://partylayer.xyz) dApp — Next.js App Router with **SSR session**.

## Develop

```bash
npm run dev
```

## How SSR session works

- **Server** ([lib/session.ts](lib/session.ts)) reads the session cookie via `next/headers` `cookies()` + `@partylayer/session`'s `createCookieStorage` → the connected party is rendered in the **initial HTML** (no disconnected→connected flash). `app/page.tsx` is a Server Component that gates on `getServerSession()`.
- **Client** ([app/providers.tsx](app/providers.tsx)) wraps the app in `PartyLayerKit` with `sessionOptions={{ storage: createCookieStorage() }}` — `document.cookie` (synchronous), the **same** cookie the server reads.
- `next/headers` is imported only in your app (`lib/session.ts`), never in `@partylayer/session` — the library stays framework-agnostic.

Switch networks by changing `network` in `app/providers.tsx` and `appName` accordingly.

## Build

```bash
npm run build && npm start
```

## Docs

- [PartyLayer docs](https://partylayer.xyz/docs/introduction)
- [@partylayer/session — createCookieStorage](https://www.npmjs.com/package/@partylayer/session)
