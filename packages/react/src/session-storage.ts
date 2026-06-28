/**
 * Browser `localStorage`-backed `SessionStorage` for the session core.
 *
 * The `@partylayer/session` core is DOM-free and never touches `localStorage`
 * itself, this adapter is the only place that does, and it is SSR-safe
 * (guards `typeof window`). The `PartyLayerProvider` injects it into the
 * session store it creates.
 */

import type { SessionStorage } from '@partylayer/session';

/**
 * Create a `SessionStorage` backed by `window.localStorage`. On the server (or
 * any environment without `localStorage`) every method is a safe no-op, so the
 * session core degrades to "no persistence" rather than throwing.
 */
export function createLocalStorage(): SessionStorage {
  const available =
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined';

  return {
    getItem(key) {
      if (!available) return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      if (!available) return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Quota / privacy-mode errors must not break the session.
      }
    },
    removeItem(key) {
      if (!available) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}
