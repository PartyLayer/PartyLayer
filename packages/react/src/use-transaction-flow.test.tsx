// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { SubmitTransactionParams, TxReceipt } from '@partylayer/core';
import { useTransactionFlow, type TransactionFlowRecord, type TransactionConfirmation } from './use-transaction-flow';

const state = vi.hoisted(() => ({
  session: { walletId: 'vala', partyId: 'alice::party', network: 'devnet', networkMismatch: undefined as unknown } as { walletId: string; partyId: string; network: string; networkMismatch?: unknown } | null,
  client: { submitTransaction: vi.fn(), getActiveSession: vi.fn() },
}));
vi.mock('./context', () => ({ usePartyLayerContext: () => state }));
const input: SubmitTransactionParams = { signedTx: { commandId: 'app-command', commands: [] } };
const receipt: TxReceipt = { submittedAt: 123, commandId: 'app-command' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  state.session = { walletId: 'vala', partyId: 'alice::party', network: 'devnet' };
  state.client.submitTransaction.mockReset().mockResolvedValue(receipt);
  state.client.getActiveSession.mockReset().mockImplementation(async () => state.session);
});
afterEach(cleanup);

describe('transaction lifecycle', () => {
  it('separates wallet approval, submission and ledger confirmation', async () => {
    const submission = deferred<TxReceipt>();
    state.client.submitTransaction.mockReturnValue(submission.promise);
    const confirmation = deferred<TransactionConfirmation>();
    const confirm = vi.fn(() => confirmation.promise);
    const view = renderHook(() => useTransactionFlow({ confirm }));
    let result!: Promise<TransactionFlowRecord>;
    act(() => { result = view.result.current.submitTransaction(input); });
    await waitFor(() => expect(view.result.current.transaction?.status).toBe('awaitingApproval'));
    await act(async () => { submission.resolve(receipt); });
    await waitFor(() => expect(view.result.current.transaction?.status).toBe('submitted'));
    expect(view.result.current.transaction?.updateId).toBeUndefined();
    await act(async () => { confirmation.resolve({ status: 'confirmed', updateId: 'ledger-update' }); await result; });
    expect(view.result.current.transaction?.status).toBe('confirmed');
    expect(view.result.current.transaction?.updateId).toBe('ledger-update');
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('leaves an acknowledgement submitted until an independent lookup confirms it', async () => {
    const view = renderHook(() => useTransactionFlow());
    let result!: TransactionFlowRecord;
    await act(async () => { result = await view.result.current.submitTransaction(input); });
    expect(result.status).toBe('submitted');
    expect(result.receipt).toEqual(receipt);
    expect(result.updateId).toBeUndefined();
  });

  it.each([4001, 'USER_REJECTED'])('recognizes explicit user rejection (%s)', async code => {
    state.client.submitTransaction.mockRejectedValue(Object.assign(new Error('Declined'), { code }));
    const view = renderHook(() => useTransactionFlow());
    await act(async () => { expect((await view.result.current.submitTransaction(input)).status).toBe('rejected'); });
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps a lost response unknown and reconciles without sending again', async () => {
    state.client.submitTransaction.mockRejectedValue(new Error('Timed out after request was accepted'));
    const confirm = vi.fn(async (_parameters: { transaction: TransactionFlowRecord; signal: AbortSignal }): Promise<TransactionConfirmation> => ({ status: 'confirmed', updateId: 'actual-ledger-update' }));
    const view = renderHook(() => useTransactionFlow({ confirm }));
    let result!: TransactionFlowRecord;
    await act(async () => { result = await view.result.current.submitTransaction(input); });
    expect(result.status).toBe('unknown');
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => { result = await view.result.current.reconcile(result.id); });
    expect(result.status).toBe('confirmed');
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0].transaction.partyId).toBe('alice::party');
  });

  it('bounds confirmation time and allows a read-only retry after a timeout', async () => {
    const confirm = vi.fn(async ({ signal }: { signal: AbortSignal }): Promise<TransactionConfirmation> => {
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
      return { status: 'unknown' };
    });
    const view = renderHook(() => useTransactionFlow({ confirm, confirmationTimeoutMs: 10 }));
    let result!: TransactionFlowRecord;
    await act(async () => { result = await view.result.current.submitTransaction(input); });
    expect(result.status).toBe('unknown');
    confirm.mockResolvedValueOnce({ status: 'confirmed', updateId: 'after-read-retry' });
    await act(async () => { result = await view.result.current.reconcile(result.id); });
    expect(result.status).toBe('confirmed');
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate clicks and a changed account before any wallet submission', async () => {
    const active = deferred<typeof state.session>();
    state.client.getActiveSession.mockReturnValue(active.promise);
    const view = renderHook(() => useTransactionFlow());
    let result!: Promise<TransactionFlowRecord>;
    act(() => { result = view.result.current.submitTransaction(input); });
    await expect(view.result.current.submitTransaction(input)).rejects.toThrow(/already pending/);
    state.session = { ...state.session!, partyId: 'bob::party' };
    view.rerender();
    await act(async () => { active.resolve(state.session); expect((await result).status).toBe('failed'); });
    expect(state.client.submitTransaction).not.toHaveBeenCalled();
    expect(view.result.current.transactions).toEqual([]);
  });

  it('keeps late submission evidence bound to the original account and does not confirm against the new one', async () => {
    const pending = deferred<TxReceipt>();
    state.client.submitTransaction.mockReturnValue(pending.promise);
    const confirm = vi.fn(async (): Promise<TransactionConfirmation> => ({ status: 'confirmed', updateId: 'x' }));
    const view = renderHook(() => useTransactionFlow({ confirm }));
    let submitted!: Promise<TransactionFlowRecord>;
    act(() => { submitted = view.result.current.submitTransaction(input); });
    await waitFor(() => expect(state.client.submitTransaction).toHaveBeenCalled());
    state.session = { ...state.session!, partyId: 'bob::party' };
    view.rerender();
    let result!: TransactionFlowRecord;
    await act(async () => { pending.resolve(receipt); result = await submitted; });
    expect(result.partyId).toBe('alice::party');
    expect(result.status).toBe('submitted');
    expect(confirm).not.toHaveBeenCalled();
    expect(view.result.current.transaction).toBeNull();
    await expect(view.result.current.reconcile(result.id)).rejects.toThrow(/does not belong/);
  });

  it('does not turn a missing/conflicting ledger id or a read error into confirmation', async () => {
    state.client.submitTransaction.mockResolvedValue({ ...receipt, updateId: 'original' });
    const confirm = vi.fn(async (): Promise<TransactionConfirmation> => ({ status: 'confirmed', updateId: 'different' }));
    const view = renderHook(() => useTransactionFlow({ confirm }));
    let result!: TransactionFlowRecord;
    await act(async () => { result = await view.result.current.submitTransaction(input); });
    expect(result.status).toBe('unknown');
    confirm.mockRejectedValueOnce(new Error('Ledger unavailable'));
    await act(async () => { result = await view.result.current.reconcile(result.id); });
    expect(result.status).toBe('unknown');
    expect(result.updateId).toBeUndefined();
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps an authoritative ledger failure distinct from submission uncertainty', async () => {
    const confirm = vi.fn(async (): Promise<TransactionConfirmation> => ({ status: 'failed', reason: 'Ledger rejected command' }));
    const view = renderHook(() => useTransactionFlow({ confirm }));
    let result!: TransactionFlowRecord;
    await act(async () => { result = await view.result.current.submitTransaction(input); });
    expect(result.status).toBe('failed');
    await act(async () => { await view.result.current.reconcile(result.id); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps late results out of a replacement client even when the account identity is unchanged', async () => {
    const original = state.client;
    const pending = deferred<TxReceipt>();
    original.submitTransaction.mockReturnValue(pending.promise);
    const view = renderHook(() => useTransactionFlow());
    let result!: Promise<TransactionFlowRecord>;
    act(() => { result = view.result.current.submitTransaction(input); });
    await waitFor(() => expect(original.submitTransaction).toHaveBeenCalled());
    state.client = { getActiveSession: vi.fn(async () => state.session), submitTransaction: vi.fn() };
    try {
      view.rerender();
      expect(view.result.current.transaction).toBeNull();
      await act(async () => { pending.resolve(receipt); await result; });
      expect(view.result.current.transaction).toBeNull();
      expect(state.client.submitTransaction).not.toHaveBeenCalled();
    } finally { state.client = original; }
  });

  it('aborts only the read-only confirmation on unmount and retains an unknown outcome', async () => {
    let stopped = false;
    const confirm = vi.fn(async ({ signal }: { signal: AbortSignal }): Promise<TransactionConfirmation> => {
      await new Promise<void>(resolve => signal.addEventListener('abort', () => { stopped = true; resolve(); }, { once: true }));
      return { status: 'unknown' };
    });
    const view = renderHook(() => useTransactionFlow({ confirm }));
    let result!: Promise<TransactionFlowRecord>;
    act(() => { result = view.result.current.submitTransaction(input); });
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    view.unmount();
    expect((await result).status).toBe('unknown');
    expect(stopped).toBe(true);
    expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid confirmation configuration before submitting anything', async () => {
    const view = renderHook(() => useTransactionFlow({ confirmationTimeoutMs: 0 }));
    await expect(view.result.current.submitTransaction(input)).rejects.toThrow(/confirmationTimeoutMs/);
    expect(state.client.submitTransaction).not.toHaveBeenCalled();
  });
});
