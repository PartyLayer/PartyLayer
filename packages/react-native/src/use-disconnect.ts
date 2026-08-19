/**
 * Disconnect hook.
 *
 * Mirrors the react package's `useDisconnect`: it calls `client.disconnect()`, records the
 * failure, and rethrows so a caller can react to it. Like the other client-based hooks it
 * takes an explicit client or reads the one from `PartyLayerProvider`, so it works with or
 * without a provider.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyLayerClient } from '@partylayer/sdk';
import { useResolvedClient } from './party-layer-context';

export interface UseDisconnectResult {
  /** Disconnect the current session. Rejects, and records `error`, on failure. */
  disconnect: () => Promise<void>;
  /** True while a disconnect is in flight. */
  isDisconnecting: boolean;
  /** The error from the last failed disconnect, or `null`. */
  error: Error | null;
}

/** Read the client from `PartyLayerProvider`. */
export function useDisconnect(): UseDisconnectResult;
/** Use an explicit client, with no provider required. */
export function useDisconnect(client: PartyLayerClient): UseDisconnectResult;
export function useDisconnect(explicitClient?: PartyLayerClient): UseDisconnectResult {
  const client = useResolvedClient(explicitClient);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // A client swap drops the previous client's error rather than showing it against the
    // new one.
    setIsDisconnecting(false);
    setError(null);
    return () => {
      mounted.current = false;
    };
  }, [client]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (mounted.current) {
      setIsDisconnecting(true);
      setError(null);
    }
    try {
      await client.disconnect();
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      if (mounted.current) setError(normalized);
      throw normalized;
    } finally {
      if (mounted.current) setIsDisconnecting(false);
    }
  }, [client]);

  return { disconnect, isDisconnecting, error };
}
