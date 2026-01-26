/**
 * React hooks for CantonConnect
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  Session,
  SignedMessage,
  SignedTransaction,
  TxReceipt,
  SignMessageParams,
  SignTransactionParams,
  SubmitTransactionParams,
  ConnectOptions,
  RegistryStatus,
} from '@cantonconnect/sdk';
import { useCantonConnectContext } from './context';

/**
 * Hook to access CantonConnect client
 */
export function useCantonConnect() {
  const { client } = useCantonConnectContext();
  if (!client) {
    throw new Error('CantonConnect client not initialized');
  }
  return client;
}

/**
 * Hook to get available wallets
 */
export function useWallets() {
  const { wallets, isLoading, error } = useCantonConnectContext();
  return { wallets, isLoading, error };
}

/**
 * Hook to get active session
 */
export function useSession() {
  const { session } = useCantonConnectContext();
  return session;
}

/**
 * Hook to get registry status
 */
export function useRegistryStatus(): {
  status: RegistryStatus | null;
  refresh: () => Promise<void>;
} {
  const client = useCantonConnect();
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
  const client = useCantonConnect();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(
    async (options?: ConnectOptions): Promise<Session | null> => {
      setIsConnecting(true);
      setError(null);

      try {
        const session = await client.connect(options);
        return session;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Connection failed');
        setError(error);
        return null;
      } finally {
        setIsConnecting(false);
      }
    },
    [client]
  );

  return { connect, isConnecting, error };
}

/**
 * Hook to disconnect from a wallet
 */
export function useDisconnect() {
  const client = useCantonConnect();
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
  const client = useCantonConnect();
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
  const client = useCantonConnect();
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
  const client = useCantonConnect();
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
