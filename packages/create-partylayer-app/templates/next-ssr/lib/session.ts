import { cookies } from 'next/headers';
import {
  createCookieStorage,
  decodeSessionEnvelope,
  type CookieAdapter,
  type PersistedSessionSnapshot,
} from '@partylayer/session';

// next/headers is imported HERE (the app), never inside @partylayer/session —
// the library stays framework-agnostic. This adapter wraps Next's read-only
// request cookies into the CookieAdapter shape createCookieStorage expects.
function nextCookieAdapter(): CookieAdapter {
  const jar = cookies();
  return {
    get: (name) => jar.get(name)?.value ?? null,
    // Server Components can only READ cookies; writes happen client-side
    // (document.cookie) or in a Route Handler / Server Action.
    set: () => {},
    remove: () => {},
  };
}

/**
 * Read the persisted session ON THE SERVER (for SSR). Returns the decoded
 * snapshot (party, network, …) or null. This is what lets a Server Component
 * render the connected state in the initial HTML — before any client JS.
 */
export function getServerSession(): PersistedSessionSnapshot | null {
  const storage = createCookieStorage({ adapter: nextCookieAdapter() });
  // Cookie reads are synchronous; the SessionStorage interface types getItem as
  // string | null | Promise, so narrow to a string (null/absent → no session).
  const raw = storage.getItem('pl_session');
  if (typeof raw !== 'string') return null;
  return decodeSessionEnvelope(raw);
}

/** Pure, server-safe party-id truncation (avoids importing a client module). */
export function truncateParty(partyId: string): string {
  if (partyId.length <= 16) return partyId;
  return `${partyId.slice(0, 10)}…${partyId.slice(-4)}`;
}
