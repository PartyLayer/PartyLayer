/**
 * Pluggable persistence for the session store.
 *
 * The core never hardcodes `localStorage` — the runtime may be non-browser
 * (Node, RN, service worker). The framework layer injects a concrete storage;
 * if none is provided the store uses an in-memory default so it always works
 * and tests stay deterministic.
 */

export type MaybePromise<T> = T | Promise<T>;

/**
 * Minimal async-friendly key/value storage. A browser app can adapt
 * `window.localStorage` (its methods are synchronous, which satisfies the
 * `MaybePromise` return types); a server can inject any KV implementation.
 */
export interface SessionStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
}

/** Default in-memory storage — safe in any runtime, never touches the DOM. */
export function createMemoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}
