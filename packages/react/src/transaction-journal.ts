import type { TransactionFlowRecord } from './use-transaction-flow';

export interface TransactionJournalOptions {
  /** Explicit app/environment namespace; never share it between unrelated apps. */
  namespace: string;
  /** Opt-in storage. For example localStorage, supplied by the app after hydration. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Storage failure must not repeat or reject an already submitted wallet write. */
  onError?(error: Error): void;
}

const LIMIT = 100;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const identifier = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 2048 && !/\p{Cc}/u.test(v);
const pending = (r: TransactionFlowRecord) => ['awaitingApproval', 'submitted', 'unknown'].includes(r.status);

/** Versioned minimal metadata only: no transaction payload, signature, error text or credentials. */
export function createTransactionJournal(options: TransactionJournalOptions): TransactionJournal {
  if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(options.namespace)) throw new Error('Invalid transaction journal namespace');
  const key = `partylayer:pending:v1:${options.namespace}`;
  const report = (reason: unknown) => {
    try { options.onError?.(reason instanceof Error ? reason : new Error(String(reason))); } catch { /* Observers cannot change a ledger write outcome. */ }
  };
  return {
    load(): TransactionFlowRecord[] {
      try {
        const raw = options.storage.getItem(key);
        if (!raw) return [];
        if (raw.length > 512_000) throw new Error('Transaction journal is too large');
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.length > LIMIT) throw new Error('Invalid transaction journal');
        const seen = new Set<string>();
        const now = Date.now();
        return data.records.map((r: Record<string, unknown>): TransactionFlowRecord => {
          if (!r || !['id', 'walletId', 'partyId', 'networkId'].every(k => identifier(r[k])) ||
            !/^canton:[a-zA-Z0-9_-]+$/.test(String(r.networkId)) ||
            !Number.isSafeInteger(r.createdAt) || (r.createdAt as number) > now || (r.createdAt as number) < now - MAX_AGE ||
            seen.has(r.id as string) || (r.commandId !== undefined && !identifier(r.commandId)) ||
            (r.updateId !== undefined && !identifier(r.updateId))) throw new Error('Invalid or expired transaction journal record');
          seen.add(r.id as string);
          return {
            id: r.id as string, walletId: r.walletId as string, partyId: r.partyId as string, networkId: r.networkId as string,
            createdAt: r.createdAt as number, updatedAt: now, status: 'unknown', restored: true,
            ...(r.commandId ? { commandId: r.commandId as string } : {}),
            ...(r.updateId ? { receipt: { submittedAt: r.createdAt as number, updateId: r.updateId as string } } : {}),
          };
        });
      } catch (reason) { report(reason); return []; }
    },
    save(records: readonly TransactionFlowRecord[]): void {
      try {
        const now = Date.now();
        const minimal = records.filter(r => pending(r) && r.createdAt >= now - MAX_AGE).slice(0, LIMIT).map(r => ({
          id: r.id, walletId: r.walletId, partyId: r.partyId, networkId: r.networkId, createdAt: r.createdAt,
          ...(r.commandId ? { commandId: r.commandId } : {}),
          ...(r.receipt?.updateId ? { updateId: r.receipt.updateId } : {}),
        }));
        if (minimal.length) options.storage.setItem(key, JSON.stringify({ version: 1, records: minimal }));
        else options.storage.removeItem(key);
      } catch (reason) { report(reason); }
    },
    clear(): void { try { options.storage.removeItem(key); } catch (reason) { report(reason); } },
  };
}

/** Optional persistence backend consumed by PartyLayerKit/PartyLayerProvider. */
export interface TransactionJournal {
  load(): TransactionFlowRecord[];
  save(records: readonly TransactionFlowRecord[]): void;
  clear(): void;
}
