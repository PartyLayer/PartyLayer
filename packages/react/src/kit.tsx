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
import type { PartyLayerClient, WalletAdapter, AdapterClass, OfficialProviderAdapter, OfficialAdapterFactory, PartyLayerConfig, NetworkId } from '@partylayer/sdk';
import type { SessionStoreOptions } from '@partylayer/session';
import { PartyLayerProvider } from './context';
import type { TransactionJournal } from './transaction-journal';
import { ThemeProvider } from './theme';
import { PartyLayerLocaleProvider, type PartyLayerDirection } from './localization';
import { PartyLayerAuthenticationProvider, type PartyLayerAuthenticationAdapter } from './authentication';
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
  /** Connection UI language (en/tr tags); unsupported languages fall back to English. */
  locale?: string;
  /** UI layout direction. Defaults to ltr. */
  direction?: PartyLayerDirection;
  /** Optional application-backend authentication; wallet connection alone is not sign-in. */
  authentication?: PartyLayerAuthenticationAdapter;

  /** Registry URL override (default: https://registry.partylayer.xyz) */
  registryUrl?: string;
  /** Optional trust roots for a signed registry. No production trust key is implied. */
  registryPublicKeys?: PartyLayerConfig['registryPublicKeys'];
  /** Optional pending-only journal. Supply a stable options object. Default: memory only. */
  transactionJournal?: TransactionJournal;
  /** Registry channel (default: 'stable') */
  channel?: 'stable' | 'beta';
  /** Replace the default wallet catalog. Omit to enable all supported wallets. */
  adapters?: (
    | WalletAdapter
    | AdapterClass
    | OfficialProviderAdapter
    | OfficialAdapterFactory
  )[];
  /** Extend the default catalog without replacing it. */
  additionalAdapters?: PartyLayerConfig['additionalAdapters'];
  /** WalletConnect Cloud project id and optional pairing metadata. */
  walletConnect?: PartyLayerConfig['walletConnect'];
  /** Bron OAuth/API configuration; omitted means Bron is hidden. */
  bron?: PartyLayerConfig['bron'];
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
  registryPublicKeys,
  transactionJournal,
  channel,
  adapters,
  additionalAdapters,
  walletConnect,
  bron,
  theme = 'light',
  locale,
  direction,
  authentication,
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
      deferInitialization: true,
      network: network as NetworkId,
      app: {
        name: appName,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      registryUrl,
      registryPublicKeys,
      channel,
      adapters: adaptersRef.current,
      additionalAdapters, walletConnect, bron,
    });
  // Keep configuration objects stable; changing them rebuilds the client.
  }, [network, appName, registryUrl, registryPublicKeys, channel, additionalAdapters, walletConnect, bron]);

  // StrictMode replays effects with the same client in development. Defer
  // disposal by one microtask so that replay does not destroy the live client
  // while its official wallet SDKs are still loading. A replaced client and a
  // real unmount still dispose normally.
  const mountedClientRef = useRef<PartyLayerClient | null>(null);
  useEffect(() => {
    mountedClientRef.current = client;
    client.initialize();
    return () => {
      mountedClientRef.current = null;
      queueMicrotask(() => {
        if (mountedClientRef.current !== client) client.destroy();
      });
    };
  }, [client]);

  const themeValue = typeof theme === 'string' ? theme : theme;
  const attribution = useMemo<AttributionConfig>(() => ({ showAttribution, disclaimer }), [showAttribution, disclaimer]);

  return (
    <PartyLayerLocaleProvider locale={locale} direction={direction}>
    <WalletIconsContext.Provider value={walletIcons}>
      <WalletOrderContext.Provider value={walletOrder}>
        <AttributionContext.Provider value={attribution}>
          <ThemeProvider theme={themeValue}>
            <PartyLayerProvider client={client} network={network} sessionOptions={sessionOptions} transactionJournal={transactionJournal}>
              {authentication ? <PartyLayerAuthenticationProvider adapter={authentication}>{children}</PartyLayerAuthenticationProvider> : children}
            </PartyLayerProvider>
          </ThemeProvider>
        </AttributionContext.Provider>
      </WalletOrderContext.Provider>
    </WalletIconsContext.Provider>
    </PartyLayerLocaleProvider>
  );
}
