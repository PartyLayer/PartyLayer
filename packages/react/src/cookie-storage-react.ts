/**
 * Cookie-backed `SessionStorage` for React, the SSR-friendly persistence option.
 *
 * This is the React-facing surface of `@partylayer/session`'s cookie storage,
 * exposed parallel to {@link createLocalStorage} so a consumer can opt into
 * cookie persistence with one import:
 *
 *   import { createCookieStorage } from '@partylayer/react';
 *   <PartyLayerProvider sessionOptions={{ storage: createCookieStorage() }}>
 *
 * WHY COOKIES FOR SSR: a cookie is the only store BOTH the server (each request)
 * and the client see. The client reads it SYNCHRONOUSLY (`document.cookie`) on the
 * first paint, so the initial client render can match server-rendered HTML without
 * a disconnected-to-connected flash. `createLocalStorage` cannot do this: the
 * server never sees `localStorage`.
 *
 * CROSS-BOUNDARY HYDRATION PATTERN (client persists, server reads the same cookie):
 *
 *  1. CLIENT (a Client Component) persists the session to a cookie. Use the
 *     default {@link documentCookieAdapter} (it wraps `document.cookie`):
 *
 *       'use client';
 *       import { createCookieStorage } from '@partylayer/react';
 *       // ...
 *       <PartyLayerProvider sessionOptions={{ storage: createCookieStorage() }}>
 *         {children}
 *       </PartyLayerProvider>
 *
 *  2. SERVER (a Server Component / RSC) reads the SAME cookie to render the
 *     connected state in the initial HTML. The read runs server-side, so it uses
 *     the framework-agnostic, RSC-safe building blocks from `@partylayer/session`
 *     (NOT from `@partylayer/react`, whose bundle is a client boundary). Inject an
 *     adapter that wraps the request cookie API (e.g. Next.js `cookies()`), then
 *     decode the persisted envelope:
 *
 *       // app/page.tsx  (a Server Component, no 'use client')
 *       import { cookies } from 'next/headers';
 *       import { createCookieStorage, decodeSessionEnvelope } from '@partylayer/session';
 *
 *       export default function Page() {
 *         const jar = cookies();
 *         const storage = createCookieStorage({
 *           adapter: {
 *             get: (name) => jar.get(name)?.value ?? null,
 *             set: () => {},     // a Server Component only reads; writes are a no-op
 *             remove: () => {},
 *           },
 *         });
 *         // The session store persists under one key; cookie storage ignores the
 *         // key and uses its cookie name, so any key reads the cookie value.
 *         const snapshot = decodeSessionEnvelope(storage.getItem('pl') ?? '');
 *         const partyId = snapshot?.account?.partyId ?? null;
 *         // ...render the server view from `partyId`, then hand off to the client
 *         //    provider, which reads the same cookie synchronously and matches.
 *       }
 *
 * Why the server half imports from `@partylayer/session`: `@partylayer/react`
 * ships its hooks and components as a client boundary, so a function imported from
 * it into a Server Component is a client reference and cannot execute server-side.
 * `@partylayer/session` is framework-agnostic and RSC-safe, so the server read
 * runs there. The dApp supplies its own cookie adapter, so neither package depends
 * on `next` / `next/headers`.
 *
 * CONSTRAINTS (carried verbatim from `@partylayer/session`'s cookie-storage):
 *  - The cookie holds the SAME versioned session envelope the encrypted backends
 *    store, but PLAINLY (not encrypted): SSR requires server-readability, and the
 *    persisted data is non-secret session metadata (public party ids, network,
 *    timestamps). It is NOT an auth token and grants no access; `restore()`
 *    re-validates against the live provider, so a forged or stale cookie cannot
 *    forge a connection.
 *  - The cookie MUST be JS-readable (NON-httpOnly) so the client `getItem` works.
 *  - Cookies are capped near 4KB per cookie; the session envelope is small, but
 *    keep custom additions modest.
 */
export {
  createCookieStorage,
  documentCookieAdapter,
} from '@partylayer/session';
export type {
  CookieAdapter,
  CookieStorageOptions,
  CookieSetOptions,
} from '@partylayer/session';
