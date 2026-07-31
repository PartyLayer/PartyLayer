/**
 * Headless wallets hook for React Native.
 *
 * Mirrors the behavior of the react package's `useWallets`: it loads the registry
 * wallet list through the client and exposes loading, success, and error states. It
 * does not reimplement any registry logic; it calls `client.listWallets(filter)`, the
 * same method the react package's hook calls. The client is passed explicitly (rather
 * than read from a context), so this stays headless with no provider component.
 *
 * Also exposes, per wallet, the icon URL and a derived format hint (see
 * {@link walletIconInfo}) so the UI components can pick a renderer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyLayerClient, WalletFilter, WalletInfo } from '@partylayer/sdk';
import { walletIconInfo, type WalletIconInfo } from './icons';

export interface UseWalletsParameters {
  /** Forwarded to `client.listWallets`. */
  filter?: WalletFilter;
}

export interface UseWalletsResult {
  /** The wallet list; `undefined` until the first load resolves. */
  wallets: WalletInfo[] | undefined;
  /** Per-wallet icon URL and format hint, aligned to `wallets`; empty until loaded. */
  walletIcons: WalletIconInfo[];
  /** True while a load is in flight (including the initial load). */
  isLoading: boolean;
  /** True once a load has resolved successfully. */
  isSuccess: boolean;
  /** True when the last load failed. */
  isError: boolean;
  /** The error from the last failed load, or `null`. */
  error: Error | null;
  /** Re-run the load. */
  refetch: () => void;
}

export function useWallets(client: PartyLayerClient, parameters: UseWalletsParameters = {}): UseWalletsResult {
  const { filter } = parameters;
  const [wallets, setWallets] = useState<WalletInfo[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  // Serialize the filter so an inline object does not retrigger the load each render.
  const filterKey = JSON.stringify(filter ?? null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    client
      .listWallets(filter)
      .then((list) => {
        if (!mounted.current) return;
        setWallets(list);
        setIsSuccess(true);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsSuccess(false);
        setIsLoading(false);
      });
    // `filter` is captured by closure; `filterKey` (its serialized form) is the
    // dependency, so an inline filter object does not recreate this each render.
  }, [client, filterKey]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const walletIcons = wallets ? wallets.map(walletIconInfo) : [];

  return {
    wallets,
    walletIcons,
    isLoading,
    isSuccess,
    isError: error !== null,
    error,
    refetch: load,
  };
}
