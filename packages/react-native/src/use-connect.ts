/**
 * Headless connect hook for React Native.
 *
 * Mirrors the behavior of the react package's connect flow: it connects and
 * disconnects through the client, tracks the current session, and surfaces status and
 * errors without swallowing them. It does not reimplement any connect logic; it calls
 * `client.connect(options)` and `client.disconnect()`, the same methods the react
 * package uses, and keeps the session current by subscribing to the client's session
 * events. The client may be passed explicitly, which is what 0.2.2 did and still works
 * unchanged, or omitted to read the one from `PartyLayerProvider`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyLayerClient, ConnectOptions, Session, PartyLayerEvent } from '@partylayer/sdk';
import { useResolvedClient } from './context';

/** The lifecycle status of the connect flow. */
export type ConnectStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface UseConnectResult {
  /** Connect a wallet. Resolves with the session; rejects (and sets `error`) on failure. */
  connect: (options?: ConnectOptions) => Promise<Session>;
  /** Disconnect the current session. */
  disconnect: () => Promise<void>;
  /** The current session, or `null` when not connected. */
  session: Session | null;
  /** The lifecycle status. */
  status: ConnectStatus;
  /** True while a connect is in flight. */
  isConnecting: boolean;
  /** True when there is a current session. */
  isConnected: boolean;
  /** The error from the last failed connect, or `null`. */
  error: Error | null;
}

/** Read the client from `PartyLayerProvider`. */
export function useConnect(): UseConnectResult;
/** Use an explicit client, with no provider required. This is the 0.2.2 form. */
export function useConnect(client: PartyLayerClient): UseConnectResult;
export function useConnect(explicitClient?: PartyLayerClient): UseConnectResult {
  const client = useResolvedClient(explicitClient);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<ConnectStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  // Initialize from the current session and keep it current via session events, so a
  // connect or disconnect anywhere is reflected here.
  useEffect(() => {
    mounted.current = true;

    // A client swap starts from a clean slate: the previous client's session must not
    // remain visible while the new client's session is still being read.
    setSession(null);
    setStatus('idle');
    setError(null);

    client
      .getActiveSession()
      .then((active) => {
        if (!mounted.current || !active) return;
        setSession(active);
        setStatus('connected');
      })
      .catch(() => {
        // No active session is normal; ignore.
      });

    const onConnected = (event: PartyLayerEvent) => {
      if (!mounted.current || event.type !== 'session:connected') return;
      setSession(event.session);
      setStatus('connected');
      setError(null);
    };
    const onGone = (_event: PartyLayerEvent) => {
      if (!mounted.current) return;
      setSession(null);
      setStatus('idle');
    };
    client.on('session:connected', onConnected);
    client.on('session:disconnected', onGone);
    client.on('session:expired', onGone);

    return () => {
      mounted.current = false;
      client.off('session:connected', onConnected);
      client.off('session:disconnected', onGone);
      client.off('session:expired', onGone);
    };
  }, [client]);

  const connect = useCallback(
    async (options?: ConnectOptions): Promise<Session> => {
      setStatus('connecting');
      setError(null);
      try {
        const next = await client.connect(options);
        if (mounted.current) {
          setSession(next);
          setStatus('connected');
        }
        return next;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        if (mounted.current) {
          setError(normalized);
          setStatus('error');
        }
        throw normalized;
      }
    },
    [client],
  );

  const disconnect = useCallback(async (): Promise<void> => {
    await client.disconnect();
    if (mounted.current) {
      setSession(null);
      setStatus('idle');
    }
  }, [client]);

  return {
    connect,
    disconnect,
    session,
    status,
    isConnecting: status === 'connecting',
    isConnected: session !== null,
    error,
  };
}
