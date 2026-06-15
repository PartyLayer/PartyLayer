---
"create-partylayer-app": minor
---

Add the **vue-nuxt-pinia** template — Nuxt 3 + Vue 3 + Pinia with server-side session rendering.

A Server-rendered page reads the session cookie via Nuxt's SSR-aware `useCookie()`, wrapped as a `CookieAdapter` and fed to `@partylayer/session`'s `createCookieStorage` — the connected party renders in the initial HTML (no flash), the same primitive the Next template feeds with `next/headers` `cookies()`. The PartyLayer session is surfaced as a **Pinia store** (`isConnected`/`party`/`status` + `connect`/`disconnect`), the idiomatic "PartyLayer + Pinia" pattern. Nuxt's cookie API stays in the app, never in `@partylayer/session`.

`create-partylayer-app` now offers three templates: `react-vite`, `next-ssr`, and `vue-nuxt-pinia`.
