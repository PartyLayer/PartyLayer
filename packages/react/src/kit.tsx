'use client';

/**
 * PartyLayerKit: zero-config wrapper for PartyLayer dApp integration.
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
import type { ThemeInput } from './theme';

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

// ─── Attribution Context ──────────────────────────────────────────────────────

/** Footer attribution config threaded from PartyLayerKit to the modal. */
export interface AttributionConfig {
  showAttribution?: boolean;
  disclaimer?: React.ReactNode;
}

const AttributionContext = createContext<AttributionConfig | undefined>(undefined);

/** Access the footer attribution config from PartyLayerKit. */
export function useAttribution(): AttributionConfig | undefined {
  return useContext(AttributionContext);
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
   * (`OfficialProviderAdapter`, e.g. `new WalleyAdapter({ host })`), the SDK
   * auto-bridges it via GenericDiscoveryAdapter (popup/remote wallets), or an
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
  /**
   * Theme: a preset ('light' | 'dark' | 'auto'), a custom `PartyLayerTheme` object,
   * a callable theme result (`darkTheme({ accentColor, borderRadius, ... })`), or a
   * dynamic `{ lightMode, darkMode }` that follows the OS preference. Default: 'light'.
   */
  theme?: ThemeInput;
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
  /**
   * Show the muted "Powered by PartyLayer" line in the connect modal footer.
   * Default: true. Set false to hide the attribution.
   */
  showAttribution?: boolean;
  /**
   * Optional legal disclaimer (Terms / Privacy) shown as a small muted line in
   * the connect modal footer. Accepts any node, so you can include links.
   */
  disclaimer?: React.ReactNode;
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
  showAttribution,
  disclaimer,
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
  const attribution = useMemo<AttributionConfig>(() => ({ showAttribution, disclaimer }), [showAttribution, disclaimer]);

  return (
    <WalletIconsContext.Provider value={walletIcons}>
      <WalletOrderContext.Provider value={walletOrder}>
        <AttributionContext.Provider value={attribution}>
          <ThemeProvider theme={themeValue}>
            <PartyLayerProvider client={client} network={network} sessionOptions={sessionOptions}>
              {children}
            </PartyLayerProvider>
          </ThemeProvider>
        </AttributionContext.Provider>
      </WalletOrderContext.Provider>
    </WalletIconsContext.Provider>
  );
}
