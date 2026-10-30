import { describe, expect, it, vi } from 'vitest';
import { createTransactionJournal } from './transaction-journal';
import type { TransactionFlowRecord } from './use-transaction-flow';

const record = (id = 'local-ui-id'): TransactionFlowRecord => ({
  id, walletId: 'vala', partyId: 'alice', networkId: 'canton:da-devnet', status: 'submitted',
  createdAt: Date.now(), updatedAt: Date.now(), commandId: 'app-command', receipt: { submittedAt: 1, updateId: 'ledger-update' },
  error: new Error('Do not store backend error details'),
});
function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
}
describe('opt-in pending transaction journal', () => {
  it('persists only minimal pending metadata and restores every record as unknown', () => {
    const s = storage(); const journal = createTransactionJournal({ namespace: 'app:devnet', storage: s });
    journal.save([record(), { ...record('confirmed'), status: 'confirmed', updateId: 'verified-update' }]);
    const raw = [...s.values.values()][0];
    expect(raw).not.toMatch(/Do not store|signature|signedTx|confirmed|submittedAt|error/);
    expect(journal.load()).toEqual([{ id: 'local-ui-id', walletId: 'vala', partyId: 'alice', networkId: 'canton:da-devnet',
      createdAt: expect.any(Number), updatedAt: expect.any(Number), status: 'unknown', restored: true, commandId: 'app-command', receipt: { submittedAt: expect.any(Number), updateId: 'ledger-update' } }]);
  });
  it('does not trust persisted terminal status, payloads or error messages', () => {
    const s = storage(); const j = createTransactionJournal({ namespace: 'a', storage: s }); j.save([record()]);
    const [key, raw] = [...s.values][0]; const data = JSON.parse(raw);
    Object.assign(data.records[0], { status: 'confirmed', updateId: 'untrusted', signedTx: { commands: ['send'] }, error: 'secret' });
    s.setItem(key, JSON.stringify(data));
    expect(j.load()[0]).toMatchObject({ status: 'unknown', restored: true });
    expect(j.load()[0]).not.toHaveProperty('signedTx');
    expect(j.load()[0]).not.toHaveProperty('updateId');
    expect(j.load()[0]).not.toHaveProperty('error');
  });
  it.each(['bad-json', 'version', 'duplicate', 'future', 'expired', 'oversized'])('ignores %s storage without stopping the app', kind => {
    const s = storage(); const onError = vi.fn(); const j = createTransactionJournal({ namespace: 'a', storage: s, onError }); j.save([record()]);
    const [key, raw] = [...s.values][0]; const data = JSON.parse(raw);
    if (kind === 'version') data.version = 2;
    if (kind === 'duplicate') data.records.push(data.records[0]);
    if (kind === 'future') data.records[0].createdAt = Date.now() + 100000;
    if (kind === 'expired') data.records[0].createdAt = Date.now() - 8 * 24 * 3600 * 1000;
    s.setItem(key, kind === 'bad-json' ? '{' : kind === 'oversized' ? 'x'.repeat(512001) : JSON.stringify(data));
    expect(j.load()).toEqual([]); expect(onError).toHaveBeenCalledOnce();
  });
  it('isolates application namespaces and supports deletion', () => {
    const s = storage(); const a = createTransactionJournal({ namespace: 'a', storage: s }); const b = createTransactionJournal({ namespace: 'b', storage: s });
    a.save([record()]); expect(b.load()).toEqual([]); a.clear(); expect(a.load()).toEqual([]);
    a.save([record()]); a.save([{ ...record(), status: 'confirmed' }]); expect(s.values.size).toBe(0);
  });
  it('does not let quota errors or observer failures change write outcomes', () => {
    const s = { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Quota'); }, removeItem: () => { throw new Error('Denied'); } };
    const j = createTransactionJournal({ namespace: 'a', storage: s, onError: () => { throw new Error('Observer failed'); } });
    expect(j.load()).toEqual([]); expect(() => j.save([record()])).not.toThrow(); expect(() => j.clear()).not.toThrow();
  });
});
