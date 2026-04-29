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
import { discoverInjectedProviders, isCip0103Native } from '@partylayer/sdk';
import {
  createNativeAdapter,
  createSyntheticWalletInfo,
  enrichProviderInfo,
  promoteRegistryToNative,
} from './native-cip0103-adapter';
import { detectInstalledWithCeiling } from './native-readiness';

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

        // Enrich each discovered provider with its status response AND a
        // registry match (when the provider's runtime identity satisfies
        // any registry entry's `providerDetection` rules). This drives both
        // "what wallet is this?" and "what should we display?" from the
        // single source of truth — the registry — without hardcoded IDs.
        const discovered = await Promise.all(
          rawDiscovered.map((d) => enrichProviderInfo(d, registryWallets)),
        );

        if (!mounted) return;

        // 1a. Adapter-AUTHORITATIVE readiness for registered CIP-0103
        //     wallets.
        //
        //     Each adapter knows its own transport (Console: postMessage;
        //     Send: window.canton; future wallets: HTTP / deeplink / etc.).
        //     If we have an adapter registered for a wallet, ITS answer
        //     is the only one that matters — `providerDetection` cannot
        //     override it. The pre-7.3 OR fallback let Send's
        //     window.canton presence (or any stray injection) flip
        //     Console's row to Ready in browsers without the Console
        //     extension; this strict path closes that class of bug.
        const cip0103Wallets = registryWallets.filter((w) => isCip0103Native(w));
        const adapterReadiness = await Promise.all(
          cip0103Wallets.map(async (entry) => {
            const adapter = client.getAdapter(String(entry.walletId));
            if (!adapter) return { walletId: String(entry.walletId), installed: false };
            const installed = await detectInstalledWithCeiling(adapter);
            return { walletId: String(entry.walletId), installed };
          }),
        );

        if (!mounted) return;

        const installedByAdapterIds = new Set(
          adapterReadiness.filter((r) => r.installed).map((r) => r.walletId),
        );

        // 1b. providerDetection match — fallback ONLY for entries that
        //     don't have a registered adapter on this client. Covers
        //     future third-party CIP-0103 wallets shipped via registry
        //     entry alone (no SDK release required for them to surface
        //     in the picker). Doesn't apply to Console / Send / any
        //     other built-in: their adapters are registered, and the
        //     adapter-authoritative path above wins.
        const matchedRegistryIds = new Set<string>();
        for (const dp of discovered) {
          if (dp.matchedWallet) matchedRegistryIds.add(String(dp.matchedWallet.walletId));
        }
        const promotedRegistryWallets = registryWallets.map((w) => {
          const id = String(w.walletId);
          const adapter = client.getAdapter(id);
          const ready = adapter
            ? installedByAdapterIds.has(id)
            : matchedRegistryIds.has(id);
          if (!ready) return w;
          const dp = discovered.find(
            (d) => d.matchedWallet && String(d.matchedWallet.walletId) === id,
          );
          return promoteRegistryToNative(w, dp?.status);
        });

        // 2. For every discovered provider that did NOT match a registry
        //    entry — i.e. an unknown CIP-0103 wallet — register a generic
        //    NativeCIP0103Adapter and synthesise a WalletInfo with derived
        //    name + canton-generic.svg. The picker still surfaces it
        //    ("show all wallets" architectural rule), just with neutral
        //    branding instead of the unrecognised raw kernel.id.
        const genericNativeWallets: WalletInfo[] = [];
        for (const dp of discovered) {
          if (dp.matchedWallet) continue; // covered by promoted registry entry
          const adapter = createNativeAdapter(dp);
          client.registerAdapter(adapter);
          genericNativeWallets.push(createSyntheticWalletInfo(dp, network));
        }

        // 3. Merge: generic-native first, then promoted+registry. The modal
        //    splits sections by `metadata.source === 'native-cip0103'`, so
        //    promoted registry entries land in the NATIVE header and the
        //    rest of the registry stays under AVAILABLE.
        const mergedWallets = [...genericNativeWallets, ...promotedRegistryWallets];

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
        if (!mounted || newDiscovered.length === 0) return;

        // Use a snapshot of the current wallet list as the registry hint.
        // For Send-class late injections this normally lands on the second
        // tick after the primary `load()` call has already populated the
        // promoted registry entries. Anything still unmatched falls back
        // to a generic-native synthesis.
        let snapshot: WalletInfo[] = [];
        setWallets((prev) => {
          snapshot = prev;
          return prev;
        });

        const enriched = await Promise.all(
          newDiscovered.map((d) => enrichProviderInfo(d, snapshot)),
        );

        if (!mounted) return;

        setWallets((current) => {
          const existingIds = new Set(current.map((w) => String(w.walletId)));
          const newNativeWallets: WalletInfo[] = [];

          for (const dp of enriched) {
            if (dp.matchedWallet) continue; // already represented by a promoted registry entry
            const adapterId = `cip0103:${dp.id}`;
            if (existingIds.has(adapterId)) continue;

            const adapter = createNativeAdapter(dp);
            client.registerAdapter(adapter);
            newNativeWallets.push(createSyntheticWalletInfo(dp, network));
          }

          if (newNativeWallets.length === 0) return current;
          return [...newNativeWallets, ...current];
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
