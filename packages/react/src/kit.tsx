/**
 * PartyLayerKit — zero-config wrapper for PartyLayer dApp integration.
 *
 * Usage:
 *   <PartyLayerKit network="devnet" appName="My dApp">
 *     <ConnectButton />
 *     <App />
 *   </PartyLayerKit>
 */

import { useMemo, useEffect, useRef } from 'react';
import { createPartyLayer } from '@partylayer/sdk';
import type { PartyLayerClient, WalletAdapter, AdapterClass, NetworkId } from '@partylayer/sdk';
import { PartyLayerProvider } from './context';
import { ThemeProvider } from './theme';
import type { PartyLayerTheme } from './theme';

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
   */
  adapters?: (WalletAdapter | AdapterClass)[];
  /** Theme preset or custom theme object (default: 'light') */
  theme?: 'light' | 'dark' | 'auto' | PartyLayerTheme;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, appName, registryUrl, channel]);

  // Cleanup on unmount or when client is re-created
  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, [client]);

  const themeValue = typeof theme === 'string' ? theme : theme;

  return (
    <ThemeProvider theme={themeValue}>
      <PartyLayerProvider client={client} network={network}>
        {children}
      </PartyLayerProvider>
    </ThemeProvider>
  );
}
