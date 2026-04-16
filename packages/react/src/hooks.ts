/**
 * React hooks for PartyLayer
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  Session,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  LedgerApiParams,
  LedgerApiResult,
  ConnectOptions,
  RegistryStatus,
} from '@partylayer/sdk';
import { usePartyLayerContext } from './context';

/**
 * Hook to access PartyLayer client
 */
export function usePartyLayer() {
  const { client } = usePartyLayerContext();
  if (!client) {
    throw new Error('PartyLayer client not initialized');
  }
  return client;
}

/**
 * Hook to get available wallets
 */
export function useWallets() {
  const { wallets, isLoading, error } = usePartyLayerContext();
  return { wallets, isLoading, error };
}

/**
 * Hook to get active session
 */
export function useSession() {
  const { session } = usePartyLayerContext();
  return session;
}

/**
 * Hook to get registry status
 */
export function useRegistryStatus(): {
  status: RegistryStatus | null;
  refresh: () => Promise<void>;
} {
  const client = usePartyLayer();
  const [status, setStatus] = useState<RegistryStatus | null>(null);

  useEffect(() => {
    // Get initial status
    const initialStatus = client.getRegistryStatus();
    if (initialStatus) {
      setStatus(initialStatus);
    }

    // Listen to registry:status events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (event: any) => {
      if (event.status) {
        setStatus(event.status as RegistryStatus);
      }
    };

    // Subscribe to registry:status event
    const unsubscribe = client.on('registry:status', handler);

    return unsubscribe;
  }, [client]);

  const refresh = useCallback(async () => {
    // Trigger registry refresh by calling listWallets
    await client.listWallets();
    // Get updated status
    const updatedStatus = client.getRegistryStatus();
    if (updatedStatus) {
      setStatus(updatedStatus);
    }
  }, [client]);

  return { status, refresh };
}

/**
 * Hook to connect to a wallet
 */
export function useConnect() {
  const client = usePartyLayer();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const connectIdRef = useRef(0);

  const connect = useCallback(
    async (options?: ConnectOptions): Promise<Session | null> => {
      const id = ++connectIdRef.current;
      setIsConnecting(true);
      setError(null);

      try {
        const session = await client.connect(options);
        // Only update state if this is still the active connect call
        if (id === connectIdRef.current) {
          return session;
        }
        return null;
      } catch (err) {
        if (id === connectIdRef.current) {
          const error = err instanceof Error ? err : new Error('Connection failed');
          setError(error);
        }
        return null;
      } finally {
        if (id === connectIdRef.current) {
          setIsConnecting(false);
        }
      }
    },
    [client]
  );

  /** Reset connecting state (e.g. when modal is closed mid-connect) */
  const reset = useCallback(() => {
    connectIdRef.current++;
    setIsConnecting(false);
    setError(null);
  }, []);

  return { connect, isConnecting, error, reset };
}

/**
 * Hook to disconnect from a wallet
 */
export function useDisconnect() {
  const client = usePartyLayer();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const disconnect = useCallback(async (): Promise<void> => {
    setIsDisconnecting(true);
    setError(null);

    try {
      await client.disconnect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Disconnect failed');
      setError(error);
      throw error;
    } finally {
      setIsDisconnecting(false);
    }
  }, [client]);

  return { disconnect, isDisconnecting, error };
}

/**
 * Hook to sign a message
 */
export function useSignMessage() {
  const client = usePartyLayer();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<SignedMessage | null> => {
      setIsSigning(true);
      setError(null);

      try {
        return await client.signMessage(params);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Sign failed');
        setError(error);
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [client]
  );

  return { signMessage, isSigning, error };
}

/**
 * Hook to sign a transaction
 */
export function useSignTransaction() {
  const client = usePartyLayer();
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signTransaction = useCallback(
    async (params: SignTransactionParams): Promise<SignedTransaction | null> => {
      setIsSigning(true);
      setError(null);

      try {
        return await client.signTransaction(params);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Sign failed');
        setError(error);
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [client]
  );

  return { signTransaction, isSigning, error };
}

/**
 * Hook to submit a transaction
 */
export function useSubmitTransaction() {
  const client = usePartyLayer();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submitTransaction = useCallback(
    async (params: SubmitTransactionParams): Promise<TxReceipt | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        return await client.submitTransaction(params);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Submit failed');
        setError(error);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [client]
  );

  return { submitTransaction, isSubmitting, error };
}

/**
 * Hook to call the Ledger API through the connected wallet
 */
export function useLedgerApi() {
  const client = usePartyLayer();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const ledgerApi = useCallback(
    async (params: LedgerApiParams): Promise<LedgerApiResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        return await client.ledgerApi(params);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Ledger API call failed');
        setError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  return { ledgerApi, isLoading, error };
}
