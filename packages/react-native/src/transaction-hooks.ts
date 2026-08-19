/**
 * Transaction hooks: sign a message, sign a transaction, submit a transaction, and call
 * the Ledger API.
 *
 * These wrap the client methods of the same name and add nothing to them. In particular
 * they add NO capability checking: the sdk client already guards every one of these and
 * throws `CapabilityNotSupportedError` before dispatching to the adapter
 * (packages/sdk/src/client.ts, in signMessage, signTransaction, submitTransaction and
 * ledgerApi). Because these call the same methods the web hooks call, a wallet that does
 * not advertise a capability produces the identical typed error here, not a raw rejection.
 *
 * The web package has two generations of these. The v2 generation is shaped as TanStack
 * Query mutations, which requires the consumer to install and provide a QueryClient. This
 * package deliberately mirrors the v1 shape instead, because it adds no dependency.
 *
 * One intentional difference from the web v1 hooks: those resolve to `null` on failure and
 * record the error. These REJECT and record the error, which is what this package's own
 * `useConnect` already does, so the two behave the same way within the package.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LedgerApiParams,
  LedgerApiResult,
  PartyLayerClient,
  SignMessageParams,
  SignTransactionParams,
  SignedMessage,
  SignedTransaction,
  SubmitTransactionParams,
  TxReceipt,
} from '@partylayer/sdk';
import { useResolvedClient } from './context';

interface MutationState<TParams, TResult> {
  run: (params: TParams) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Shared core for the four hooks below: pending flag, error capture, rethrow, an unmount
 * guard so a late settle writes no state, and a reset when the client is swapped.
 */
function useClientMutation<TParams, TResult>(
  client: PartyLayerClient,
  call: (client: PartyLayerClient, params: TParams) => Promise<TResult>,
): MutationState<TParams, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // A client swap drops the previous client's pending flag and error.
    setIsPending(false);
    setError(null);
    return () => {
      mounted.current = false;
    };
  }, [client]);

  const run = useCallback(
    async (params: TParams): Promise<TResult> => {
      if (mounted.current) {
        setIsPending(true);
        setError(null);
      }
      try {
        return await call(client, params);
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        if (mounted.current) setError(normalized);
        throw normalized;
      } finally {
        if (mounted.current) setIsPending(false);
      }
    },
    [client, call],
  );

  const reset = useCallback(() => {
    if (mounted.current) {
      setIsPending(false);
      setError(null);
    }
  }, []);

  return { run, isPending, error, reset };
}

export interface UseSignMessageResult {
  /** Sign a message. Rejects, and records `error`, on failure. */
  signMessage: (params: SignMessageParams) => Promise<SignedMessage>;
  isSigning: boolean;
  error: Error | null;
  reset: () => void;
}

/** Read the client from `PartyLayerProvider`. */
export function useSignMessage(): UseSignMessageResult;
/** Use an explicit client, with no provider required. */
export function useSignMessage(client: PartyLayerClient): UseSignMessageResult;
export function useSignMessage(explicitClient?: PartyLayerClient): UseSignMessageResult {
  const client = useResolvedClient(explicitClient);
  const { run, isPending, error, reset } = useClientMutation<SignMessageParams, SignedMessage>(
    client,
    signMessageCall,
  );
  return { signMessage: run, isSigning: isPending, error, reset };
}

export interface UseSignTransactionResult {
  /** Sign a transaction. Rejects, and records `error`, on failure. */
  signTransaction: (params: SignTransactionParams) => Promise<SignedTransaction>;
  isSigning: boolean;
  error: Error | null;
  reset: () => void;
}

/** Read the client from `PartyLayerProvider`. */
export function useSignTransaction(): UseSignTransactionResult;
/** Use an explicit client, with no provider required. */
export function useSignTransaction(client: PartyLayerClient): UseSignTransactionResult;
export function useSignTransaction(explicitClient?: PartyLayerClient): UseSignTransactionResult {
  const client = useResolvedClient(explicitClient);
  const { run, isPending, error, reset } = useClientMutation<
    SignTransactionParams,
    SignedTransaction
  >(client, signTransactionCall);
  return { signTransaction: run, isSigning: isPending, error, reset };
}

export interface UseSubmitTransactionResult {
  /** Submit a transaction. Rejects, and records `error`, on failure. */
  submitTransaction: (params: SubmitTransactionParams) => Promise<TxReceipt>;
  isSubmitting: boolean;
  error: Error | null;
  reset: () => void;
}

/** Read the client from `PartyLayerProvider`. */
export function useSubmitTransaction(): UseSubmitTransactionResult;
/** Use an explicit client, with no provider required. */
export function useSubmitTransaction(client: PartyLayerClient): UseSubmitTransactionResult;
export function useSubmitTransaction(explicitClient?: PartyLayerClient): UseSubmitTransactionResult {
  const client = useResolvedClient(explicitClient);
  const { run, isPending, error, reset } = useClientMutation<SubmitTransactionParams, TxReceipt>(
    client,
    submitTransactionCall,
  );
  return { submitTransaction: run, isSubmitting: isPending, error, reset };
}

export interface UseLedgerApiResult {
  /** Call the Ledger API through the connected wallet. Rejects on failure. */
  ledgerApi: (params: LedgerApiParams) => Promise<LedgerApiResult>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

/** Read the client from `PartyLayerProvider`. */
export function useLedgerApi(): UseLedgerApiResult;
/** Use an explicit client, with no provider required. */
export function useLedgerApi(client: PartyLayerClient): UseLedgerApiResult;
export function useLedgerApi(explicitClient?: PartyLayerClient): UseLedgerApiResult {
  const client = useResolvedClient(explicitClient);
  const { run, isPending, error, reset } = useClientMutation<LedgerApiParams, LedgerApiResult>(
    client,
    ledgerApiCall,
  );
  return { ledgerApi: run, isLoading: isPending, error, reset };
}

// Module-level callers so the `call` identity is stable across renders and the memoized
// `run` is not rebuilt on every render.
function signMessageCall(client: PartyLayerClient, params: SignMessageParams): Promise<SignedMessage> {
  return client.signMessage(params);
}
function signTransactionCall(
  client: PartyLayerClient,
  params: SignTransactionParams,
): Promise<SignedTransaction> {
  return client.signTransaction(params);
}
function submitTransactionCall(
  client: PartyLayerClient,
  params: SubmitTransactionParams,
): Promise<TxReceipt> {
  return client.submitTransaction(params);
}
function ledgerApiCall(client: PartyLayerClient, params: LedgerApiParams): Promise<LedgerApiResult> {
  return client.ledgerApi(params);
}
