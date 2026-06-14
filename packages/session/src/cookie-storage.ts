/**
 * Cookie-backed `SessionStorage` — the SSR-friendly persistence backend.
 *
 * WHY: cookies are the only store BOTH the server (each request) and the client
 * see. The server reads the session to render the connected state in the initial
 * HTML; the client reads the SAME cookie SYNCHRONOUSLY (`document.cookie`) so the
 * first client paint matches the server HTML — no disconnected→connected flash
 * (the flash you get from async IndexedDB hydration).
 *
 * FRAMEWORK-AGNOSTIC: this module NEVER imports `next/headers`. On the client the
 * default {@link documentCookieAdapter} uses `document.cookie`; on the server the
 * app injects an adapter that wraps its framework's cookie API (e.g. Next's
 * `cookies()` from `next/headers`). The adapter's only contract is round-trip
 * string fidelity (what you `set` is what you `get`).
 *
 * THREAT MODEL (honest — see README):
 *  - The cookie stores the SAME versioned session envelope the encrypted
 *    backends store (`encodeSessionEnvelope`), but PLAINLY (the adapter handles
 *    transport encoding), NOT encrypted. Encryption parity with the
 *    IndexedDB/localStorage backends is IMPOSSIBLE here by design: their
 *    AES-GCM-256 key is non-extractable and lives only in IndexedDB (see
 *    `crypto.ts`), so a server could never decrypt it — and SSR REQUIRES
 *    server-readability.
 *  - The persisted data is NON-SECRET session metadata: party ids (public
 *    on-chain identifiers), network, timestamps. PartyLayer is non-custodial —
 *    wallets hold keys; the session is an address-book entry, not a credential.
 *  - The cookie is NOT an auth token; it grants no access. The store's
 *    `restore()` re-validates the connection against the LIVE provider (it uses
 *    storage only as a presence marker), so a forged or stale cookie cannot forge
 *    a connection — at worst it causes a brief incorrect SSR paint that the
 *    client corrects on hydrate.
 *  - The cookie MUST be JS-readable (NON-`httpOnly`) so the client `getItem`
 *    works; `httpOnly` would break the `SessionStorage` contract on the client.
 *  - Tamper-evidence (an optional sign/verify transform) is a documented FUTURE
 *    opt-in. {@link CookieStorageOptions} is an extensible bag, so a `sign?` /
 *    `verify?` hook can be added in a later minor WITHOUT a breaking change.
 */
import type { SessionStorage } from './storage';

/** Cookie attributes applied on write. */
export interface CookieSetOptions {
  /** Lifetime in seconds. */
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  expires?: Date;
}

/**
 * Cookie transport. The default reads/writes `document.cookie`; a server adapter
 * wraps the host framework's cookie API. Contract: `get` returns exactly the
 * string a prior `set` stored (the adapter owns any transport encoding).
 */
export interface CookieAdapter {
  get(name: string): string | null;
  set(name: string, value: string, options?: CookieSetOptions): void;
  remove(name: string, options?: CookieSetOptions): void;
}

/**
 * Options for {@link createCookieStorage}. Intentionally an extensible bag: a
 * future `sign?`/`verify?` transform hook is additive here (no signature change).
 */
export interface CookieStorageOptions {
  /** Cookie read/write transport. Defaults to {@link documentCookieAdapter}. */
  adapter?: CookieAdapter;
  /** Cookie name (single-session). Defaults to `"pl_session"`. */
  name?: string;
  /** Lifetime in seconds. Defaults to 30 days. */
  maxAge?: number;
  /** Cookie path. Defaults to `"/"`. */
  path?: string;
  /** SameSite attribute. Defaults to `"lax"`. */
  sameSite?: 'lax' | 'strict' | 'none';
  /** Add the `Secure` attribute (recommended in production / required for SameSite=None). */
  secure?: boolean;
}

const DEFAULT_COOKIE_NAME = 'pl_session';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_PATH = '/';
const DEFAULT_SAME_SITE: 'lax' | 'strict' | 'none' = 'lax';

function capitalizeSameSite(v: 'lax' | 'strict' | 'none'): 'Lax' | 'Strict' | 'None' {
  return (v.charAt(0).toUpperCase() + v.slice(1)) as 'Lax' | 'Strict' | 'None';
}

/** Serialize a `Set-Cookie`-style string for `document.cookie`. */
function serializeCookie(name: string, value: string, options?: CookieSetOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options?.path ?? DEFAULT_PATH}`);
  if (options?.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  const sameSite = options?.sameSite ?? DEFAULT_SAME_SITE;
  parts.push(`SameSite=${capitalizeSameSite(sameSite)}`);
  if (options?.secure || sameSite === 'none') parts.push('Secure');
  return parts.join('; ');
}

/**
 * Default browser adapter backed by `document.cookie`. Safe (no-op reads/writes)
 * when `document` is undefined (e.g. evaluated on the server before an adapter is
 * injected). Handles URL-encoding so arbitrary envelope strings round-trip.
 */
export function documentCookieAdapter(): CookieAdapter {
  return {
    get(name) {
      if (typeof document === 'undefined') return null;
      const prefix = `${name}=`;
      for (const part of document.cookie ? document.cookie.split('; ') : []) {
        if (part.startsWith(prefix)) {
          try {
            return decodeURIComponent(part.slice(prefix.length));
          } catch {
            return part.slice(prefix.length);
          }
        }
      }
      return null;
    },
    set(name, value, options) {
      if (typeof document === 'undefined') return;
      document.cookie = serializeCookie(name, value, options);
    },
    remove(name, options) {
      if (typeof document === 'undefined') return;
      document.cookie = serializeCookie(name, '', { ...options, maxAge: 0, expires: new Date(0) });
    },
  };
}

/**
 * Build a cookie-backed {@link SessionStorage}. Reads/writes are SYNCHRONOUS, so
 * client hydration is flash-free. The session uses a single storage key, so this
 * persists to one cookie (`name`); the `key` argument is accepted to satisfy the
 * interface but the cookie name is fixed.
 *
 * @example Browser (client) — the default:
 *   createSessionStore(provider, { storage: createCookieStorage() })
 *
 * @example Next.js server (read for SSR) — inject a cookies() adapter:
 *   import { cookies } from 'next/headers';
 *   const jar = cookies();
 *   const storage = createCookieStorage({
 *     adapter: {
 *       get: (name) => jar.get(name)?.value ?? null,
 *       set: (name, value, o) => jar.set(name, value, { maxAge: o?.maxAge, path: o?.path, sameSite: o?.sameSite, secure: o?.secure }),
 *       remove: (name) => jar.delete(name),
 *     },
 *   });
 */
export function createCookieStorage(options: CookieStorageOptions = {}): SessionStorage {
  const adapter = options.adapter ?? documentCookieAdapter();
  const name = options.name ?? DEFAULT_COOKIE_NAME;
  const setOptions: CookieSetOptions = {
    maxAge: options.maxAge ?? DEFAULT_MAX_AGE,
    path: options.path ?? DEFAULT_PATH,
    sameSite: options.sameSite ?? DEFAULT_SAME_SITE,
    secure: options.secure,
  };

  return {
    getItem(_key: string): string | null {
      return adapter.get(name);
    },
    setItem(_key: string, value: string): void {
      adapter.set(name, value, setOptions);
    },
    removeItem(_key: string): void {
      adapter.remove(name, setOptions);
    },
  };
}
