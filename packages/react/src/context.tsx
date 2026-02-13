/**
 * React context for PartyLayer
 *
 * Manages wallet listing (registry + native CIP-0103 discovery),
 * session state, and event subscriptions.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type {
  PartyLayerClient,
  Session,
  WalletInfo,
} from '@partylayer/sdk';
import { discoverInjectedProviders } from '@partylayer/sdk';
import {
  createNativeAdapter,
  createSyntheticWalletInfo,
  enrichProviderInfo,
} from './native-cip0103-adapter';

interface PartyLayerContextValue {
  client: PartyLayerClient | null;
  session: Session | null;
  wallets: WalletInfo[];
  isLoading: boolean;
  error: Error | null;
}

const PartyLayerContext =
  createContext<PartyLayerContextValue | null>(null);

export function usePartyLayerContext(): PartyLayerContextValue {
  const context = useContext(PartyLayerContext);
  if (!context) {
    throw new Error(
      'usePartyLayer must be used within PartyLayerProvider'
    );
  }
  return context;
}

interface PartyLayerProviderProps {
  client: PartyLayerClient;
  children: React.ReactNode;
  /** Network identifier for native CIP-0103 wallet discovery */
  network?: string;
}

export function PartyLayerProvider({
  client,
  children,
  network = 'devnet',
}: PartyLayerProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Fetch registry wallets and discover native CIP-0103 providers in parallel.
        // listWallets() is resilient — if registry is unreachable, it falls back
        // to generating WalletInfo from registered adapters (Console, Loop, etc.)
        const [sessionData, registryWallets, rawDiscovered] = await Promise.all([
          client.getActiveSession(),
          client.listWallets(),
          Promise.resolve(discoverInjectedProviders()),
        ]);

        if (!mounted) return;

        // Enrich discovered providers with status info (name, etc.)
        const discovered = await Promise.all(
          rawDiscovered.map((d) => enrichProviderInfo(d)),
        );

        if (!mounted) return;

        // Register native adapters with the client and create synthetic WalletInfo
        const nativeWallets: WalletInfo[] = [];
        const registryWalletIds = new Set(registryWallets.map((w) => String(w.walletId)));

        for (const dp of discovered) {
          const adapterId = `cip0103:${dp.id}`;
          // Skip if there's already a registry wallet that covers this provider
          if (registryWalletIds.has(adapterId)) continue;

          const adapter = createNativeAdapter(dp);
          client.registerAdapter(adapter);

          const walletInfo = createSyntheticWalletInfo(dp, network);
          nativeWallets.push(walletInfo);
        }

        // Merge: native (detected) wallets first, then registry wallets
        const mergedWallets = [...nativeWallets, ...registryWallets];

        setSession(sessionData);
        setWallets(mergedWallets);
        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setWallets([]); // Ensure wallets is empty array on error
          setIsLoading(false);
        }
      }
    }

    load();

    // Delayed re-discovery for late-injecting extensions (e.g. Console Wallet
    // can take up to 3s to inject into window). Re-scan at 2.5s and merge any
    // newly found native CIP-0103 providers into the wallet list.
    const rediscoverTimeout = setTimeout(async () => {
      if (!mounted) return;
      try {
        const newDiscovered = await Promise.resolve(discoverInjectedProviders());
        const enriched = await Promise.all(
          newDiscovered.map((d) => enrichProviderInfo(d)),
        );

        if (!mounted) return;

        setWallets((prev) => {
          const existingIds = new Set(prev.map((w) => String(w.walletId)));
          const newNativeWallets: WalletInfo[] = [];

          for (const dp of enriched) {
            const adapterId = `cip0103:${dp.id}`;
            if (existingIds.has(adapterId)) continue;

            const adapter = createNativeAdapter(dp);
            client.registerAdapter(adapter);
            newNativeWallets.push(createSyntheticWalletInfo(dp, network));
          }

          if (newNativeWallets.length === 0) return prev;
          // Prepend newly found native wallets (before registry ones)
          return [...newNativeWallets, ...prev];
        });
      } catch {
        /* ignore re-discovery failures */
      }
    }, 2500);

    // Subscribe to events
    const unsubscribeConnect = client.on('session:connected', (event) => {
      if (!mounted) return;
      if (event.type === 'session:connected') {
        setSession(event.session);
      }
    });

    const unsubscribeDisconnect = client.on('session:disconnected', () => {
      if (!mounted) return;
      setSession(null);
    });

    const unsubscribeExpired = client.on('session:expired', () => {
      if (!mounted) return;
      setSession(null);
    });

    const unsubscribeError = client.on('error', (event) => {
      if (!mounted) return;
      if (event.type === 'error') {
        setError(event.error);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(rediscoverTimeout);
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeExpired();
      unsubscribeError();
    };
  }, [client]);

  return (
    <PartyLayerContext.Provider
      value={{
        client,
        session,
        wallets,
        isLoading,
        error,
      }}
    >
      {children}
    </PartyLayerContext.Provider>
  );
}
