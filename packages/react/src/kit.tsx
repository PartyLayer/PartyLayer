/**
 * PartyLayerKit — zero-config wrapper for PartyLayer dApp integration.
 *
 * Usage:
 *   <PartyLayerKit network="devnet" appName="My dApp">
 *     <ConnectButton />
 *     <App />
 *   </PartyLayerKit>
 */

import { useMemo, useEffect, useRef, createContext, useContext } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import type { PartyLayerClient, WalletAdapter, AdapterClass, OfficialProviderAdapter, OfficialAdapterFactory, NetworkId } from '@partylayer/sdk';
import type { SessionStoreOptions } from '@partylayer/session';
import { PartyLayerProvider } from './context';
import { ThemeProvider } from './theme';
import type { PartyLayerTheme } from './theme';

// ─── Wallet Icons Context ─────────────────────────────────────────────────────

/** Map of walletId → icon URL for custom wallet logos */
export type WalletIconMap = Record<string, string>;

const WalletIconsContext = createContext<WalletIconMap>({});

/** Access wallet icon overrides from PartyLayerKit */
export function useWalletIcons(): WalletIconMap {
  return useContext(WalletIconsContext);
}

// ─── Wallet Order Context ─────────────────────────────────────────────────────

const WalletOrderContext = createContext<readonly string[] | undefined>(undefined);

/** Access the wallet display-order override from PartyLayerKit */
export function useWalletOrder(): readonly string[] | undefined {
  return useContext(WalletOrderContext);
}

/**
 * Resolve icon URL for a wallet. Priority:
 * 1. walletIcons map (exact match or fuzzy)
 * 2. wallet.icons.sm from registry
 * 3. null (caller renders fallback)
 */
export function resolveWalletIcon(
  walletId: string,
  walletIcons: WalletIconMap,
  registryIconUrl?: string,
): string | null {
  const id = walletId.replace(/^cip0103:/, '');
  // Exact match
  if (walletIcons[id]) return walletIcons[id];
  if (walletIcons[walletId]) return walletIcons[walletId];
  // Fuzzy match
  for (const [key, url] of Object.entries(walletIcons)) {
    if (id.toLowerCase().includes(key.toLowerCase())) return url;
  }
  // Registry fallback
  if (registryIconUrl) return registryIconUrl;
  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PartyLayerKitProps {
  /** Canton network to connect to */
  network: 'devnet' | 'testnet' | 'mainnet';
  /** Application name shown to wallets during connection */
  appName: string;
  children: React.ReactNode;

  /** Registry URL override (default: https://registry.partylayer.xyz) */
  registryUrl?: string;
  /** Registry channel (default: 'stable') */
  channel?: 'stable' | 'beta';
  /**
   * Custom wallet adapters. If not provided, uses built-in adapters:
   * Console Wallet, 5N Loop, Cantor8.
   *
   * For Bron (enterprise OAuth), pass explicitly:
   *   adapters={[...getBuiltinAdapters(), new BronAdapter(config)]}
   *
   * Also accepts an official @canton-network ProviderAdapter
   * (`OfficialProviderAdapter`, e.g. `new WalleyAdapter({ host })`) — the SDK
   * auto-bridges it via GenericDiscoveryAdapter (popup/remote wallets) — or an
   * `OfficialAdapterFactory` (`{ providerId, create(host) }`), whose host the SDK
   * resolves from the registry entry's `networkHosts[network]` so you set
   * `network="…"` and never hardcode a wallet URL.
   */
  adapters?: (
    | WalletAdapter
    | AdapterClass
    | OfficialProviderAdapter
    | OfficialAdapterFactory
  )[];
  /** Theme preset or custom theme object (default: 'light') */
  theme?: 'light' | 'dark' | 'auto' | PartyLayerTheme;
  /** Custom wallet icon URLs by walletId */
  walletIcons?: WalletIconMap;
  /**
   * Wallet ids in display order for the connect modal; wallets not listed fall
   * to the end. Sorts within the CIP-0103 Native / Available sections.
   */
  walletOrder?: readonly string[];
  /**
   * session-store options forwarded to `PartyLayerProvider`
   * (`reconnect`, `expiry`, `broadcast`, `persistSnapshot`, `storage`,
   * `onInvalidate`). Lets the app opt into encrypted persistence, auto-reconnect,
   * and multi-tab sync. Omitted ⇒ today's defaults.
   */
  sessionOptions?: Partial<SessionStoreOptions>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PartyLayerKit({
  network,
  appName,
  children,
  registryUrl,
  channel,
  adapters,
  theme = 'light',
  walletIcons = {},
  walletOrder,
  sessionOptions,
}: PartyLayerKitProps) {
  // Stable reference for adapters array to avoid re-creating client on every render
  const adaptersRef = useRef(adapters);
  adaptersRef.current = adapters;

  const client = useMemo((): PartyLayerClient => {
    return createPartyLayer({
      network: network as NetworkId,
      app: {
        name: appName,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      registryUrl,
      channel,
      adapters: adaptersRef.current,
    });
  // Only re-create client when these primitive values change
  }, [network, appName, registryUrl, channel]);

  // Cleanup on unmount or when client is re-created
  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, [client]);

  const themeValue = typeof theme === 'string' ? theme : theme;

  return (
    <WalletIconsContext.Provider value={walletIcons}>
      <WalletOrderContext.Provider value={walletOrder}>
        <ThemeProvider theme={themeValue}>
          <PartyLayerProvider client={client} network={network} sessionOptions={sessionOptions}>
            {children}
          </PartyLayerProvider>
        </ThemeProvider>
      </WalletOrderContext.Provider>
    </WalletIconsContext.Provider>
  );
}
