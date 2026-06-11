/**
 * Session store provisioning for Vue — `provideSessionStore` (the core) and a
 * thin `createPartyLayerSession` plugin that wraps the same provide, so there is
 * a single source of truth (one injection key, one store-resolution path).
 *
 * Ownership rule:
 *   - Built from config → THIS layer owns the lifecycle: `init()` runs
 *     client-only (`onMounted`), `destroy()` on scope/app teardown.
 *   - A PRE-BUILT store → its lifecycle belongs to the caller; we NEVER
 *     `init()`/`destroy()` it.
 *
 * SSR-safe: the store is constructed without DOM access; `init()` is deferred to
 * `onMounted` (client only), so server rendering never touches the wallet.
 */
import { inject, onMounted, onScopeDispose, provide, type App, type InjectionKey, type Plugin } from 'vue';
import { createSessionStore, type SessionStore, type SessionStoreOptions } from '@partylayer/session';
import type { CIP0103Provider } from '@partylayer/core';

/** Injection key for the shared session store (or `null` when none provided). */
export const SESSION_STORE_KEY: InjectionKey<SessionStore | null> = Symbol('partylayer.session.store');

/** Either a pre-built store, or config to build one (provider + store options). */
export type ProvideSessionConfig =
  | SessionStore
  | ({ provider: CIP0103Provider } & Partial<SessionStoreOptions>);

function isStore(config: ProvideSessionConfig): config is SessionStore {
  return typeof (config as SessionStore).getSnapshot === 'function';
}

/** Resolve a config into a store + whether THIS layer owns its lifecycle. */
function resolveStore(config: ProvideSessionConfig): { store: SessionStore; owned: boolean } {
  if (isStore(config)) return { store: config, owned: false };
  const { provider, ...options } = config;
  return { store: createSessionStore(provider, options), owned: true };
}

/**
 * Provide a session store to descendant composables. Call in a component
 * `setup()` (e.g. your root). Returns the store for direct use if needed.
 *
 * When built from config, lifecycle is owned here (client-only `init()` on
 * mount, `destroy()` on scope teardown). A pre-built store is left untouched.
 */
export function provideSessionStore(config: ProvideSessionConfig): SessionStore {
  const { store, owned } = resolveStore(config);
  provide(SESSION_STORE_KEY, store);
  if (owned) {
    // Client-only restore/reconnect; never runs during SSR.
    onMounted(() => {
      void store.init();
    });
    onScopeDispose(() => {
      store.destroy();
    });
  }
  return store;
}

/**
 * Vue plugin form — a THIN wrapper over the same provide/resolution, for
 * `app.use(...)`. Owned stores `init()` on the client at install and `destroy()`
 * when the app unmounts.
 */
export function createPartyLayerSession(config: ProvideSessionConfig): Plugin {
  return {
    install(app: App) {
      const { store, owned } = resolveStore(config);
      app.provide(SESSION_STORE_KEY, store);
      if (owned) {
        if (typeof window !== 'undefined') void store.init(); // client only (SSR-safe)
        const unmount = app.unmount.bind(app);
        app.unmount = () => {
          try {
            store.destroy();
          } finally {
            unmount();
          }
        };
      }
    },
  };
}

/** Internal: read the provided store, or `null` if none (SSR / outside provider). */
export function injectSessionStore(): SessionStore | null {
  return inject(SESSION_STORE_KEY, null);
}
