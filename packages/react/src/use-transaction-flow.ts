'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toCAIP2Network, type SubmitTransactionParams, type TxReceipt } from '@partylayer/core';
import { usePartyLayerContext } from './context';
import { useTransactionHistoryStore } from './transaction-history';

export type TransactionFlowStatus = 'awaitingApproval' | 'submitted' | 'confirmed' | 'rejected' | 'failed' | 'unknown';
export interface TransactionFlowRecord {
  /** Local UI identifier only; never a ledger hash or command id. */
  readonly id: string;
  readonly walletId: string;
  readonly partyId: string;
  readonly networkId: string;
  readonly status: TransactionFlowStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Original app command id captured before submission; not a receipt's assertion. */
  readonly commandId?: string;
  /** Restored browser metadata is untrusted; reconciliation checks ledger inclusion, not business intent. */
  readonly restored?: boolean;
  readonly receipt?: TxReceipt;
  /** Present only after an independent ledger confirmation. */
  readonly updateId?: string;
  readonly error?: Error;
}

export type TransactionConfirmation =
  | { status: 'confirmed'; updateId: string }
  | { status: 'failed'; reason: string }
  | { status: 'unknown'; reason?: string };

export interface UseTransactionFlowParameters {
  /** Read-only application ledger lookup. Must never submit/retry a transaction. */
  confirm?(parameters: { transaction: TransactionFlowRecord; signal: AbortSignal }): Promise<TransactionConfirmation>;
  /** Timeout of the read-only confirmation, not a cancellation of the ledger write. Default 30s. */
  confirmationTimeoutMs?: number;
}

export interface UseTransactionFlowReturn {
  /** Latest transaction for the CURRENT wallet/party/network; null if none. */
  transaction: TransactionFlowRecord | null;
  /** History for the current identity, newest first; at most twenty records. */
  transactions: readonly TransactionFlowRecord[];
  isPending: boolean;
  /** One wallet call, no automatic retry. Inspect the returned status, including unknown. */
  submitTransaction(parameters: SubmitTransactionParams, metadata?: { commandId: string }): Promise<TransactionFlowRecord>;
  /** Repeat only the read-only confirmation lookup. Never resubmits. */
  reconcile(id: string): Promise<TransactionFlowRecord>;
}

const recordKey = (record: { walletId: unknown; partyId: unknown; networkId: string }) =>
  JSON.stringify([String(record.walletId), String(record.partyId), record.networkId]);
const asError = (reason: unknown) => reason instanceof Error ? reason : new Error(String(reason));
const EMPTY: readonly TransactionFlowRecord[] = [];
const noop = () => () => {};
const getEmpty = () => EMPTY;

export function useTransactionFlow(parameters: UseTransactionFlowParameters = {}): UseTransactionFlowReturn {
  const { client, session } = usePartyLayerContext();
  const history = useTransactionHistoryStore();
  const shared = useSyncExternalStore(history?.subscribe ?? noop, history?.getSnapshot ?? getEmpty, getEmpty);
  const key = session ? recordKey({ ...session, networkId: toCAIP2Network(session.network).networkId }) : '';
  const active = useRef({ key, session, client, parameters });
  active.current = { key, session, client, parameters };
  const records = useRef<readonly TransactionFlowRecord[]>([]);
  const recordsOwner = useRef(client);
  if (recordsOwner.current !== client) { records.current = []; recordsOwner.current = client; }
  const [entries, setEntries] = useState({ client, records: records.current });
  const [isPending, setPending] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const confirmations = useRef(new Map<string, AbortController>());
  const epochs = useRef(new Map<string, number>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const controller of confirmations.current.values()) controller.abort();
    };
  }, []);
  const write = useCallback((record: TransactionFlowRecord): TransactionFlowRecord => {
    if (active.current.client === client) {
      records.current = records.current.some(item => item.id === record.id)
        ? records.current.map(item => item.id === record.id ? record : item)
        : [record, ...records.current].slice(0, 20);
      if (mounted.current) setEntries({ client, records: records.current });
    }
    if (history) {
      if (!epochs.current.has(record.id)) epochs.current.set(record.id, history.getEpoch());
      history.write(record, epochs.current.get(record.id));
    }
    return record;
  }, [client, history]);

  const reconcile = useCallback(async (id: string): Promise<TransactionFlowRecord> => {
    if (!mounted.current || active.current.client !== client) throw new Error('Transaction client is no longer active');
    const record = (history?.getSnapshot() ?? records.current).find(item => item.id === id);
    if (!record || recordKey(record) !== active.current.key) throw new Error('Transaction does not belong to the current wallet account and network');
    if (record.status === 'confirmed' || record.status === 'failed' || record.status === 'rejected') return record;
    if (record.status === 'awaitingApproval') throw new Error('Wait for the wallet request to finish before reconciling');
    const { confirm, confirmationTimeoutMs = 30_000 } = active.current.parameters;
    if (!confirm) return record;
    if (!Number.isFinite(confirmationTimeoutMs) || confirmationTimeoutMs <= 0 || confirmationTimeoutMs > 300_000) {
      throw new Error('confirmationTimeoutMs must be between 1 and 300000');
    }
    if (confirmations.current.has(id)) throw new Error('Transaction confirmation is already pending');
    if (history) epochs.current.set(id, history.getEpoch());
    const controller = new AbortController();
    confirmations.current.set(id, controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const cancelled = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Ledger confirmation stopped; the transaction outcome is unknown')), { once: true });
        timer = setTimeout(() => controller.abort(), confirmationTimeoutMs);
      });
      const outcome = await Promise.race([confirm({ transaction: record, signal: controller.signal }), cancelled]);
      if (!outcome || !['confirmed', 'failed', 'unknown'].includes(outcome.status)) throw new Error('Invalid ledger confirmation result');
      if (outcome.status === 'confirmed') {
        if (typeof outcome.updateId !== 'string' || !outcome.updateId.trim() ||
          (record.receipt?.updateId && outcome.updateId !== record.receipt.updateId)) {
          throw new Error('Ledger confirmation returned an invalid or conflicting update id');
        }
        return write({ ...record, status: 'confirmed', updateId: outcome.updateId, error: undefined, updatedAt: Date.now() });
      }
      return write({ ...record, status: outcome.status,
        error: outcome.reason ? new Error(outcome.reason) : undefined, updatedAt: Date.now() });
    } catch (reason) {
      return write({ ...record, status: 'unknown', error: asError(reason), updatedAt: Date.now() });
    } finally {
      if (timer) clearTimeout(timer);
      confirmations.current.delete(id);
    }
  }, [client, history, write]);

  const submitTransaction = useCallback(async (input: SubmitTransactionParams, metadata?: { commandId: string }): Promise<TransactionFlowRecord> => {
    if (!mounted.current) throw new Error('Transaction flow is unmounted');
    if (active.current.client !== client) throw new Error('Transaction client changed');
    if (pending.current) throw new Error('A transaction request is already pending');
    const captured = active.current;
    if (metadata && (typeof metadata.commandId !== 'string' || !metadata.commandId || metadata.commandId.length > 2048 || /\p{Cc}/u.test(metadata.commandId))) throw new Error('Invalid original command id');
    if (metadata && input.signedTx && typeof input.signedTx === 'object' && 'commandId' in input.signedTx &&
      input.signedTx.commandId !== metadata.commandId) throw new Error('Original command id does not match the submitted payload');
    if (!captured.client || !captured.session || captured.session.networkMismatch) throw new Error('Connect a wallet on the supported network first');
    const timeout = captured.parameters.confirmationTimeoutMs;
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0 || timeout > 300_000)) {
      throw new Error('confirmationTimeoutMs must be between 1 and 300000');
    }
    pending.current = true;
    setPending(true);
    let record = write({
      id: crypto.randomUUID(), walletId: String(captured.session.walletId),
      partyId: String(captured.session.partyId), networkId: toCAIP2Network(captured.session.network).networkId,
      status: 'awaitingApproval', createdAt: Date.now(), updatedAt: Date.now(),
      ...(metadata ? { commandId: metadata.commandId } : {}),
    });
    let requestedWallet = false;
    try {
      const live = await captured.client.getActiveSession();
      if (!live || captured.key !== recordKey({ ...live, networkId: toCAIP2Network(live.network).networkId }) ||
        active.current.key !== captured.key || active.current.client !== captured.client || !mounted.current) {
        return write({ ...record, status: 'failed', error: new Error('Wallet account or network changed before submission'), updatedAt: Date.now() });
      }
      // Exactly one wallet submission. Read-only confirmation failures never
      // re-enter this call, including when a wallet accepted a timed-out request.
      requestedWallet = true;
      const receipt = await captured.client.submitTransaction(input);
      record = write({ ...record, receipt, status: 'submitted', updatedAt: Date.now() });
      if (active.current.key !== captured.key || active.current.client !== captured.client || !mounted.current) return record;
      return await reconcile(record.id);
    } catch (reason) {
      const error = asError(reason);
      const code = (reason as { code?: unknown } | null)?.code;
      return write({ ...record, status: !requestedWallet ? 'failed' : code === 4001 || code === 'USER_REJECTED' ? 'rejected' : 'unknown', error, updatedAt: Date.now() });
    } finally {
      pending.current = false;
      if (mounted.current) setPending(false);
    }
  }, [client, reconcile, write]);

  const transactions = (history ? shared : entries.client === client ? entries.records : EMPTY).filter(record => recordKey(record) === key).slice(0, 20);
  return { transaction: transactions[0] ?? null, transactions, isPending, submitTransaction, reconcile };
}
