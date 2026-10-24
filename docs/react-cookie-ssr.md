# Cookie-backed session storage for SSR (React)

The default React kit keeps its live session projection in memory. An application
can explicitly provide cookie storage when it wants server-readable UI hints.
That cookie contains public account/network metadata, not a verified login.
Wallet restoration still checks the live provider.

Do not use a decoded party ID to authorize server content. Use an independently
verified backend session for protected routes; see [authentication](./authentication.md).

## Why use a cookie?

Browser localStorage and IndexedDB cannot be read by a Server Component. A cookie
can carry a small UI hint in a request, so the server can render an initial account
summary. It does not guarantee that live wallet restoration will succeed or that
all client/server renders are identical. Handle loading, expired and invalid hints.

## Client: persist to a cookie

Pass `createCookieStorage()` as the provider's storage. The default adapter wraps
`document.cookie`, so this is all the client needs:

```tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import { PartyLayerKit } from '@partylayer/react';
import { createCookieStorage } from '@partylayer/session';

export function Providers({ children }: { children: ReactNode }) {
  const storage = useMemo(() => createCookieStorage(), []);
  return (
    <PartyLayerKit network="devnet" appName="My dApp" sessionOptions={{ storage }}>
      {children}
    </PartyLayerKit>
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

export default async function Page() {
  const jar = await cookies();
  const storage = createCookieStorage({
    adapter: {
      get: (name) => jar.get(name)?.value ?? null,
      set: () => {},     // a Server Component only reads; writes are a no-op here
      remove: () => {},
    },
  });

  // The session store persists under one key; cookie storage ignores the key and
  // uses its cookie name, so any key reads the cookie value.
  const raw = await storage.getItem('pl');
  const snapshot = typeof raw === 'string' ? decodeSessionEnvelope(raw) : null;
  const partyId = snapshot?.account?.partyId ?? null;

  // This is a display hint only. Read protected data from a verified server session.
  return <p>Last account: {partyId ?? 'No saved account'}</p>;
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
  cannot forge a connection; the server hint can be stale or forged and the client must
  resolve it against the live wallet. Backend authorization must be independent.
- The cookie must be JS-readable (non-httpOnly) so the client read works.
- Cookies are capped near 4KB each. The session envelope is small; keep any custom
  additions modest.
- Use `secure` in production (and it is required when `sameSite` is `none`).
