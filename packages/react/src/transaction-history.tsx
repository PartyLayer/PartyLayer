'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { toCAIP2Network, type Session } from '@partylayer/core';
import type { TransactionFlowRecord } from './use-transaction-flow';
import { useLocale } from './localization';
import { useTheme } from './theme';
import type { TransactionJournal } from './transaction-journal';

const EMPTY: readonly TransactionFlowRecord[] = [];
const noop = () => () => {};
const getEmpty = () => EMPTY;
interface TransactionHistoryStore {
  getSnapshot(): readonly TransactionFlowRecord[];
  subscribe(listener: () => void): () => void;
  write(record: TransactionFlowRecord, epoch?: number): void;
  getEpoch(): number;
  restore(): void;
  clear(): void;
}
const Context = createContext<{ store: TransactionHistoryStore; session: Session | null } | null>(null);
export const useTransactionHistoryStore = () => useContext(Context)?.store ?? null;

/** Per-client history; optional pending-only journal. Never sent to telemetry. */
export function TransactionHistoryProvider({ children, client, session, journal }: { children: React.ReactNode; client: object; session: Session | null; journal?: TransactionJournal }) {
  const store = useMemo<TransactionHistoryStore>(() => {
    let records: readonly TransactionFlowRecord[] = EMPTY;
    const listeners = new Set<() => void>();
    const persistence = journal;
    let restored = false;
    let epoch = 0;
    const restore = () => {
      if (restored) return;
      restored = true;
      let loaded: TransactionFlowRecord[] = [];
      try { loaded = persistence?.load() ?? []; } catch { /* Persistence cannot break wallet activity. */ }
      records = [...records, ...loaded.filter(r => !records.some(item => item.id === r.id))].slice(0, 100);
      listeners.forEach(listener => listener());
    };
    return {
      getSnapshot: () => records,
      getEpoch: () => epoch,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      write: (record, expectedEpoch) => {
        if (expectedEpoch !== undefined && expectedEpoch !== epoch) return;
        restore();
        records = records.some(item => item.id === record.id)
          ? records.map(item => item.id === record.id ? record : item)
          : [record, ...records].slice(0, 100);
        try { persistence?.save(records); } catch { /* A quota/backend failure must never repeat a wallet write. */ }
        listeners.forEach(listener => listener());
      },
      restore,
      clear: () => { epoch++; records = EMPTY; try { persistence?.clear(); } catch { /* Best-effort persistence cleanup. */ } listeners.forEach(listener => listener()); },
    };
  }, [client, journal]);
  useEffect(() => { store.restore(); }, [store]);
  const value = useMemo(() => ({ store, session }), [store, session]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Clear all activity in this provider and its optional journal (for example at app sign-out). */
export function useClearRecentTransactions(): () => void {
  return useTransactionHistoryStore()?.clear ?? (() => {});
}

/** Current wallet/party/network only. A command id or local id is never treated as confirmation. */
export function useRecentTransactions(): readonly TransactionFlowRecord[] {
  const context = useContext(Context);
  const store = context?.store;
  const session = context?.session;
  const records = useSyncExternalStore(store?.subscribe ?? noop, store?.getSnapshot ?? getEmpty, getEmpty);
  return useMemo(() => session ? records.filter(record => record.walletId === String(session.walletId) &&
    record.partyId === String(session.partyId) && record.networkId === toCAIP2Network(session.network).networkId).slice(0, 20) : EMPTY,
  [records, session]);
}

/** Presentational recent activity; pass only ledger-verified records as confirmed. */
export function RecentTransactions({ transactions, limit = 5 }: {
  transactions: readonly TransactionFlowRecord[];
  limit?: number;
}) {
  const { t, locale, direction } = useLocale();
  const theme = useTheme();
  if (!transactions.length) return null;
  return <section lang={locale} dir={direction} aria-label={t('recentTransactions')}
    style={{ padding: '12px 16px', color: theme.colors.text, fontFamily: theme.fontFamily, fontSize: '12px' }}>
    <div style={{ fontWeight: 600, marginBottom: '8px' }}><bdi dir="auto">{t('recentTransactions')}</bdi></div>
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {transactions.slice(0, Math.max(1, Math.min(20, Math.floor(limit) || 5))).map(record => {
        const text = record.status === 'confirmed' ? t('txConfirmed') : record.status === 'awaitingApproval' ? t('awaitingApproval')
          : record.status === 'submitted' ? t('submitted') : record.status === 'rejected' ? t('txRejected')
          : record.status === 'failed' ? t('txFailed', { reason: record.error?.message ?? t('unknownError') }) : t('txUnknown');
        const identifier = record.updateId ?? record.receipt?.updateId ?? record.receipt?.commandId ?? record.receipt?.transactionHash;
        return <li key={record.id} data-status={record.status} style={{ padding: '6px 0', overflowWrap: 'anywhere' }}>
          <div><bdi dir="auto">{text}</bdi></div>
          {identifier && <div dir="ltr" style={{ marginTop: '3px', color: theme.colors.textSecondary,
            fontFamily: 'ui-monospace, monospace', fontSize: '11px' }}>{String(identifier)}</div>}
        </li>;
      })}
    </ol>
  </section>;
}
