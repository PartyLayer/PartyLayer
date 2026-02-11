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
        // Fetch registry wallets and discover native CIP-0103 providers in parallel
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
