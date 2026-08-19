/**
 * React Native provider and context.
 *
 * Mirrors the react package's `PartyLayerProvider`: the context holds the client, the
 * active session, the registry wallet list, load state, and the shared framework-agnostic
 * `SessionStore` that the account and session hooks read. The provider does not create or
 * dispose the client; the app passes it in and owns its lifetime. Only the session store
 * is owned here.
 *
 * The provider is OPTIONAL. Every hook in this package also accepts an explicit client, so
 * an app written against 0.2.2 keeps working with no provider anywhere in its tree.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { PartyLayerClient, Session, WalletInfo } from '@partylayer/sdk';
import {
  createSessionStore,
  type SessionStore,
  type SessionStoreOptions,
} from '@partylayer/session';
import { createAsyncStorage } from './storage';
import type { RNAsyncStorage } from './types';

export interface PartyLayerContextValue {
  client: PartyLayerClient | null;
  /** The sdk-level session, kept current by the client's session events. */
  session: Session | null;
  wallets: WalletInfo[];
  isLoading: boolean;
  error: Error | null;
  /** Shared session store, read by `useAccount`, `useSession` and `useAccountEffect`. */
  store: SessionStore | null;
}

const PartyLayerContext = createContext<PartyLayerContextValue | null>(null);

/**
 * Read the context. Throws when no provider is above, naming the provider so the fix is
 * obvious. Hooks called with an explicit client never reach this.
 */
export function usePartyLayerContext(): PartyLayerContextValue {
  const context = useContext(PartyLayerContext);
  if (!context) {
    throw new Error(
      'No PartyLayerProvider found. Wrap your app in <PartyLayerProvider client={client}>, ' +
        'or pass the client to the hook directly, for example useConnect(client).',
    );
  }
  return context;
}

/** The client from context. Throws when there is no provider, or no client on it. */
export function usePartyLayer(): PartyLayerClient {
  const { client } = usePartyLayerContext();
  if (!client) {
    throw new Error('PartyLayer client not initialized');
  }
  return client;
}

/**
 * Whether a value is a PartyLayer client rather than a hook parameters object.
 *
 * Deliberately duck typed rather than `instanceof PartyLayerClient`. Two reasons: test
 * doubles and stubs are plain objects that would fail an instance check, and a tree with
 * two copies of the sdk installed would fail it too. The parameter objects this has to be
 * told apart from (`UseWalletsParameters`) carry no methods, so a value exposing `connect`
 * or `listWallets` is unambiguously a client.
 */
export function isPartyLayerClient(value: unknown): value is PartyLayerClient {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { connect?: unknown; listWallets?: unknown };
  return typeof candidate.connect === 'function' || typeof candidate.listWallets === 'function';
}

/**
 * Resolve the client a hook should use: the explicit argument when given, else the one
 * from context. Kept in one place so every hook behaves identically.
 *
 * Hooks must call this unconditionally (it is a hook itself) to keep hook order stable.
 */
export function useResolvedClient(explicit?: PartyLayerClient): PartyLayerClient {
  const context = useContext(PartyLayerContext);
  if (explicit) return explicit;
  if (!context?.client) {
    throw new Error(
      'No PartyLayerProvider found. Wrap your app in <PartyLayerProvider client={client}>, ' +
        'or pass the client to the hook directly, for example useConnect(client).',
    );
  }
  return context.client;
}

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
