/**
 * React context for PartyLayer.
 *
 * Surface kept minimal: the registry-derived wallet list, the active
 * session, and event subscriptions. Runtime CIP-0103 detection used to
 * live here (Prompts 7.2-7.5 evolved through several variants) but
 * proved fragile because every adapter has different transport
 * semantics and any divergence between the modal's expectation and the
 * adapter's answer surfaced as a misleading "Ready" indicator.
 *
 * Prompt 7.6 simplification: the modal renders the registry directly.
 * Each adapter's `connect()` flow handles install / QR / popup
 * fallbacks at click-time — that's where transport-specific knowledge
 * actually lives, and the right place for it.
 *
 * Detection helpers (`detectInstalled`, `matchesProviderDetection`,
 * `findMatchingWallet`, etc.) remain exported by `@partylayer/sdk`
 * and `@partylayer/registry-client` for advanced consumers and the
 * conformance suite — only the picker stops consuming them.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type {
  PartyLayerClient,
  Session,
  WalletInfo,
} from '@partylayer/sdk';

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
  /** Network identifier (kept for backward compat; no longer used for native synthesis). */
  network?: string;
}

export function PartyLayerProvider({
  client,
  children,
}: PartyLayerProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Registry list + active session in parallel. listWallets() is
        // resilient: if the registry is unreachable, the SDK falls back
        // to generating WalletInfo entries from the adapters that are
        // already registered (so the picker still has something to show).
        const [sessionData, registryWallets] = await Promise.all([
          client.getActiveSession(),
          client.listWallets(),
        ]);

        if (!mounted) return;

        setSession(sessionData);
        setWallets(registryWallets);
        setIsLoading(false);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setWallets([]);
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
