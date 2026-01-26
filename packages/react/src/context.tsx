/**
 * React context for CantonConnect
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type {
  CantonConnectClient,
  Session,
  WalletInfo,
} from '@cantonconnect/sdk';

interface CantonConnectContextValue {
  client: CantonConnectClient | null;
  session: Session | null;
  wallets: WalletInfo[];
  isLoading: boolean;
  error: Error | null;
}

const CantonConnectContext =
  createContext<CantonConnectContextValue | null>(null);

export function useCantonConnectContext(): CantonConnectContextValue {
  const context = useContext(CantonConnectContext);
  if (!context) {
    throw new Error(
      'useCantonConnect must be used within CantonConnectProvider'
    );
  }
  return context;
}

interface CantonConnectProviderProps {
  client: CantonConnectClient;
  children: React.ReactNode;
}

export function CantonConnectProvider({
  client,
  children,
}: CantonConnectProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [sessionData, walletsData] = await Promise.all([
          client.getActiveSession(),
          client.listWallets(),
        ]);

        if (mounted) {
          setSession(sessionData);
          setWallets(walletsData);
          setIsLoading(false);
        }
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
    <CantonConnectContext.Provider
      value={{
        client,
        session,
        wallets,
        isLoading,
        error,
      }}
    >
      {children}
    </CantonConnectContext.Provider>
  );
}
