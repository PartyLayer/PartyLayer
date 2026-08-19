/**
 * Headless wallets hook for React Native.
 *
 * Mirrors the behavior of the react package's `useWallets`: it loads the registry
 * wallet list through the client and exposes loading, success, and error states. It
 * does not reimplement any registry logic; it calls `client.listWallets(filter)`, the
 * same method the react package's hook calls. The client may be passed explicitly, which
 * is what 0.2.2 did and still works unchanged, or omitted to read the one from
 * `PartyLayerProvider`.
 *
 * Also exposes, per wallet, the icon URL and a derived format hint (see
 * {@link walletIconInfo}) so the UI components can pick a renderer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyLayerClient, WalletFilter, WalletInfo } from '@partylayer/sdk';
import { walletIconInfo, type WalletIconInfo } from './icons';
import { isPartyLayerClient, useResolvedClient } from './party-layer-context';

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

/** Read the client from `PartyLayerProvider`. */
export function useWallets(): UseWalletsResult;
/** Read the client from `PartyLayerProvider`, with parameters. */
export function useWallets(parameters: UseWalletsParameters): UseWalletsResult;
/** Use an explicit client, with no provider required. This is the 0.2.2 form. */
export function useWallets(
  client: PartyLayerClient,
  parameters?: UseWalletsParameters,
): UseWalletsResult;
export function useWallets(
  clientOrParameters?: PartyLayerClient | UseWalletsParameters,
  maybeParameters: UseWalletsParameters = {},
): UseWalletsResult {
  // One argument is either the client (0.2.2 form) or the parameters (provider form).
  const explicitClient = isPartyLayerClient(clientOrParameters) ? clientOrParameters : undefined;
  const parameters = isPartyLayerClient(clientOrParameters)
    ? maybeParameters
    : ((clientOrParameters as UseWalletsParameters | undefined) ?? {});
  const client = useResolvedClient(explicitClient);
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
    // A client swap (or a filter change) starts from a clean slate rather than showing
    // the previous client's wallets while the new list loads.
    setWallets(undefined);
    setIsSuccess(false);
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
