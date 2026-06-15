---
"create-partylayer-app": minor
---

Add the **next-ssr** template — Next.js App Router with server-side session rendering.

A Server Component reads the session cookie (`next/headers` `cookies()` + `@partylayer/session`'s `createCookieStorage@^1.1.0`) and renders the connected party in the initial HTML — no disconnected→connected flash. The client wraps the app in `PartyLayerKit` with `sessionOptions={{ storage: createCookieStorage() }}` (the same cookie, read synchronously). `next/headers` is imported only in the scaffolded app, never in `@partylayer/session`.

`create-partylayer-app` now offers two templates: `react-vite` and `next-ssr`.
