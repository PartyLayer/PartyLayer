---
"@partylayer/session": minor
---

Add `createCookieStorage()` — a cookie-backed `SessionStorage`, the SSR-friendly persistence backend.

Readable on both the server (via an injected `CookieAdapter`, e.g. wrapping Next's `cookies()`) and the client (`document.cookie`), so a Server Component can render the connected state in the initial HTML and the client hydrates from the same cookie synchronously — no disconnected→connected flash. `@partylayer/session` stays framework-agnostic (it never imports `next/headers`; the app injects the server adapter).

The cookie stores the same versioned session envelope as the encrypted backends, but **plainly** — full AES-GCM parity is impossible here (that key is non-extractable + IndexedDB-only, so a server can't decrypt it), and the data is non-secret session metadata (party ids are public; PartyLayer is non-custodial). The cookie is not an auth token: the store's `restore()` re-validates against the live provider, so a forged cookie can't forge a connection. Optional tamper-evident signing is a documented future opt-in (`CookieStorageOptions` is extensible).

Purely additive — new `createCookieStorage` / `documentCookieAdapter` exports and `CookieAdapter` / `CookieSetOptions` / `CookieStorageOptions` types. No change to existing storages, exports, or the default backend.
