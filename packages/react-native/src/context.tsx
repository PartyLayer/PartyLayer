/**
 * The React Native provider.
 *
 * Mirrors the react package's `PartyLayerProvider`: it holds the client, the active
 * session, the registry wallet list, load state, and the shared `SessionStore` the account
 * hooks read. It does not create or dispose the client; the app passes it in and owns its
 * lifetime. Only the session store is owned here.
 *
 * The provider is OPTIONAL. Every hook in this package also accepts an explicit client, so
 * an app written against 0.2.2 keeps working with no provider anywhere in its tree.
 *
 * The context object and its reader hooks live in ./party-layer-context so that importing a
 * component does not pull `createSessionStore` into the bundle.
 */
import { useEffect, useRef, useState } from 'react';
import type { PartyLayerClient, Session, WalletInfo } from '@partylayer/sdk';
import { createSessionStore, type SessionStore, type SessionStoreOptions } from '@partylayer/session';
import { createAsyncStorage } from './storage';
import type { RNAsyncStorage } from './types';
import { PartyLayerContext } from './party-layer-context';

export {
  usePartyLayerContext,
  usePartyLayer,
  useResolvedClient,
  isPartyLayerClient,
  PartyLayerContext,
} from './party-layer-context';
export type { PartyLayerContextValue } from './party-layer-context';

export interface PartyLayerProviderProps {
  client: PartyLayerClient;
  children: React.ReactNode;
  /**
   * AsyncStorage module used to persist the session across app restarts.
   *
   * Without it the session store falls back to in-memory storage on React Native, because
   * the shared default requires IndexedDB, which React Native does not have. In-memory
   * means the session is gone the next time the app launches. Pass
   * `import AsyncStorage from '@react-native-async-storage/async-storage'` to persist it.
   * An explicit `sessionOptions.storage` takes precedence over this.
   */
  asyncStorage?: RNAsyncStorage;
  /**
   * Session store options (`reconnect`, `expiry`, `broadcast`, `persistSnapshot`,
   * `onInvalidate`, `storage`), merged into the store this provider creates.
   */
  sessionOptions?: Partial<SessionStoreOptions>;
}

export function PartyLayerProvider({
  client,
  children,
  asyncStorage,
  sessionOptions,
}: PartyLayerProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // One store per client, created during render so the hooks can read it on first paint,
  // and rebuilt when the client, the options, or the storage module changes. The ref is
  // cleared by the mount effect's cleanup, so a StrictMode remount builds a fresh,
  // re-subscribed store rather than reusing a destroyed one.
  const optionsRef = useRef(sessionOptions);
  const storageRef = useRef(asyncStorage);
  const storeRef = useRef<{ client: PartyLayerClient; store: SessionStore } | null>(null);
  if (
    storeRef.current === null ||
    storeRef.current.client !== client ||
    optionsRef.current !== sessionOptions ||
    storageRef.current !== asyncStorage
  ) {
    storeRef.current?.store.destroy();
    optionsRef.current = sessionOptions;
    storageRef.current = asyncStorage;
    storeRef.current = {
      client,
      store: createSessionStore(client.asProvider(), {
        // An explicit storage in sessionOptions wins; otherwise AsyncStorage when the app
        // supplied it; otherwise the shared default, which is in-memory here.
        ...(asyncStorage ? { storage: createAsyncStorage(asyncStorage) } : {}),
        ...sessionOptions,
      }),
    };
  }
  const store = storeRef.current.store;

  useEffect(() => {
    void store.init();
    return () => {
      store.destroy();
      if (storeRef.current?.store === store) storeRef.current = null;
    };
  }, [store]);

  useEffect(() => {
    let mounted = true;

    // A client swap must not leave the previous client's session or wallets on screen.
    setSession(null);
    setWallets([]);
    setError(null);
    setIsLoading(true);

    async function load() {
      try {
        const [sessionData, registryWallets] = await Promise.all([
          client.getActiveSession(),
          client.listWallets(),
        ]);
        if (!mounted) return;
        setSession(sessionData);
        setWallets(registryWallets);
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setWallets([]);
        setIsLoading(false);
      }
    }

    void load();

    const onConnected = (event: { type: string; session?: Session }) => {
      if (!mounted) return;
      if (event.type === 'session:connected' && event.session) setSession(event.session);
    };
    const onGone = () => {
      if (!mounted) return;
      setSession(null);
    };
    const onError = (event: { type: string; error?: Error }) => {
      if (!mounted) return;
      if (event.type === 'error' && event.error) setError(event.error);
    };
    // Re-list rather than trusting an event payload: the client does the authoritative
    // gating, so a late announcement should go through the same path as the first load.
    const onWalletsChanged = () => {
      if (!mounted) return;
      client
        .listWallets()
        .then((next) => {
          if (mounted) setWallets(next);
        })
        .catch(() => {
          /* transient discovery failure, keep the current list */
        });
    };

    const unsubscribes = [
      client.on('session:connected', onConnected as never),
      client.on('session:disconnected', onGone as never),
      client.on('session:expired', onGone as never),
      client.on('error', onError as never),
      client.on('wallets:changed', onWalletsChanged as never),
    ];

    return () => {
      mounted = false;
      for (const unsubscribe of unsubscribes) {
        if (typeof unsubscribe === 'function') unsubscribe();
      }
    };
  }, [client]);

  return (
    <PartyLayerContext.Provider value={{ client, session, wallets, isLoading, error, store }}>
      {children}
    </PartyLayerContext.Provider>
  );
}
