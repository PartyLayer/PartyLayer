'use client';

import { useMemo, type ReactNode } from 'react';
import { PartyLayerKit } from '@partylayer/react';
import { createCookieStorage } from '@partylayer/session';

/**
 * Client provider boundary. cookieStorage on the client uses document.cookie
 * (synchronous → flash-free), the SAME cookie the server reads in lib/session.ts
 * — so server HTML and client hydration agree.
 */
export function Providers({ children }: { children: ReactNode }) {
  const storage = useMemo(() => createCookieStorage(), []);
  return (
    <PartyLayerKit network="devnet" appName="{{PROJECT_NAME}}" sessionOptions={{ storage }}>
      {children}
    </PartyLayerKit>
  );
}
