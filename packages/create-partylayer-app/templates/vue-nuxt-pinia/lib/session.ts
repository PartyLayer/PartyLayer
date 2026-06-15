import {
  createCookieStorage,
  decodeSessionEnvelope,
  type CookieAdapter,
  type PersistedSessionSnapshot,
} from '@partylayer/session';
import type { Ref } from 'vue';

/**
 * Wrap a Nuxt `useCookie()` ref as a `CookieAdapter`. `useCookie` is SSR-aware:
 * on the server it reads the request's Cookie header, on the client it reads
 * `document.cookie`. This is the SAME `CookieAdapter` interface next-ssr feeds
 * with `next/headers` `cookies()` — different framework, one primitive. Nuxt's
 * cookie API lives ONLY here (the app), never inside `@partylayer/session`.
 */
export function nuxtCookieAdapter(cookieRef: Ref<string | null | undefined>): CookieAdapter {
  return {
    get: () => cookieRef.value ?? null,
    set: (_name, value) => {
      cookieRef.value = value;
    },
    remove: () => {
      cookieRef.value = null;
    },
  };
}

/**
 * Read the persisted session on the server (for SSR) from the cookie ref, so a
 * page can render the connected party in the initial HTML — before any client JS.
 */
export function getServerSession(
  cookieRef: Ref<string | null | undefined>,
): PersistedSessionSnapshot | null {
  const storage = createCookieStorage({ adapter: nuxtCookieAdapter(cookieRef) });
  // Cookie reads are synchronous; narrow the MaybePromise interface type.
  const raw = storage.getItem('pl_session');
  if (typeof raw !== 'string') return null;
  return decodeSessionEnvelope(raw);
}

/** Pure, server-safe party-id truncation. */
export function truncateParty(partyId: string): string {
  if (partyId.length <= 16) return partyId;
  return `${partyId.slice(0, 10)}…${partyId.slice(-4)}`;
}
