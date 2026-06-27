# Cookie-backed session storage for SSR (React)

PartyLayer persists a small, non-secret session marker (the connected party id,
network, and timestamp) so a returning user renders as connected without a flash.
For server-side rendering you want that marker readable on BOTH the server (to
render the connected state in the initial HTML) and the client (to match it on the
first paint). A cookie is the only store both sides see, so `@partylayer/react`
exposes a cookie-backed `SessionStorage` option next to the default and the
`localStorage` option.

## Why a cookie (and not localStorage)

`createLocalStorage()` works on the client only: the server never sees
`localStorage`, so a server render cannot know the session, and the client paints
disconnected first and then flips to connected after hydration. A cookie is sent
with every request, so the server reads it per request and the client reads the
same value synchronously via `document.cookie`. The first client paint matches the
server HTML.

## Client: persist to a cookie

Pass `createCookieStorage()` as the provider's storage. The default adapter wraps
`document.cookie`, so this is all the client needs:

```tsx
'use client';
import { PartyLayerProvider } from '@partylayer/react';
import { createCookieStorage } from '@partylayer/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PartyLayerProvider sessionOptions={{ storage: createCookieStorage() }}>
      {children}
    </PartyLayerProvider>
  );
}
```

This is exactly parallel to `createLocalStorage()`; only the backend changes.

## Server: read the same cookie for hydration

The server read runs in a Server Component, so it uses the framework-agnostic,
RSC-safe building blocks from `@partylayer/session` (not from `@partylayer/react`,
whose bundle is a client boundary). Inject an adapter that wraps your framework's
request cookie API. For Next.js App Router that is `cookies()` from `next/headers`:

```tsx
// app/page.tsx  (a Server Component, no 'use client')
import { cookies } from 'next/headers';
import { createCookieStorage, decodeSessionEnvelope } from '@partylayer/session';

export default function Page() {
  const jar = cookies();
  const storage = createCookieStorage({
    adapter: {
      get: (name) => jar.get(name)?.value ?? null,
      set: () => {},     // a Server Component only reads; writes are a no-op here
      remove: () => {},
    },
  });

  // The session store persists under one key; cookie storage ignores the key and
  // uses its cookie name, so any key reads the cookie value.
  const snapshot = decodeSessionEnvelope(storage.getItem('pl') ?? '');
  const partyId = snapshot?.account?.partyId ?? null;

  // Render the server view from `partyId`, then hand off to the client provider
  // above, which reads the same cookie synchronously and matches this render.
  return <YourApp initialPartyId={partyId} />;
}
```

Neither package imports `next/headers`; you supply the adapter, so the same code
works with any framework that exposes request cookies.

## Why the server import is from `@partylayer/session`

`@partylayer/react` ships its hooks and components as a client boundary
(`'use client'`), which is what lets you import them into Server Components as
client islands. A consequence is that a function imported from `@partylayer/react`
into a Server Component is a client reference and cannot execute on the server.
The cookie read is server logic, so it uses `@partylayer/session`, which is
framework-agnostic and RSC-safe. The client convenience re-export
(`createCookieStorage` from `@partylayer/react`) and the server building block
(`createCookieStorage` from `@partylayer/session`) are the same function.

## Constraints and threat model

- The cookie holds the same versioned session envelope the encrypted backends
  store, but plainly, not encrypted: SSR requires server-readability, and the
  persisted data is non-secret session metadata (public party ids, network,
  timestamps). It is not an auth token and grants no access. The store's
  `restore()` re-validates against the live provider, so a forged or stale cookie
  cannot forge a connection; at worst it causes a brief incorrect SSR paint that
  the client corrects on hydrate.
- The cookie must be JS-readable (non-httpOnly) so the client read works.
- Cookies are capped near 4KB each. The session envelope is small; keep any custom
  additions modest.
- Use `secure` in production (and it is required when `sameSite` is `none`).
