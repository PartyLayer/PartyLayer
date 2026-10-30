// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { toPartyId, toWalletId, type Session } from '@partylayer/core';
import { TransactionHistoryProvider, RecentTransactions, useRecentTransactions, useClearRecentTransactions } from './transaction-history';
import { useTransactionFlow } from './use-transaction-flow';
import { PartyLayerLocaleProvider } from './localization';
import { createTransactionJournal } from './transaction-journal';

const state = vi.hoisted(() => ({ session: null as Session | null,
  client: { getActiveSession: vi.fn(), submitTransaction: vi.fn() } }));
vi.mock('./context', () => ({ usePartyLayerContext: () => state }));
beforeEach(() => {
  state.session = { partyId: toPartyId('alice'), walletId: toWalletId('vala'), network: 'devnet' } as Session;
  state.client.getActiveSession.mockReset().mockImplementation(async () => state.session);
  state.client.submitTransaction.mockReset().mockResolvedValue({ submittedAt: 1, commandId: 'command-for-lookup' });
});
afterEach(cleanup);

it('shares transaction activity with the account UI, filters party/network/wallet, and resets only the store when the client changes', async () => {
  let providerClient: object = state.client;
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <TransactionHistoryProvider client={providerClient} session={state.session}>{children}</TransactionHistoryProvider>;
  const view = renderHook(() => ({ flow: useTransactionFlow(), history: useRecentTransactions(), local: useState(7) }), { wrapper });
  await act(async () => { await view.result.current.flow.submitTransaction({ signedTx: {} }); });
  expect(view.result.current.history).toHaveLength(1);
  expect(view.result.current.history[0].status).toBe('submitted');
  const original = state.session;
  for (const changed of [{ partyId: toPartyId('bob') }, { network: 'mainnet' }, { walletId: toWalletId('cauri') }]) {
    state.session = { ...original!, ...changed } as Session;
    view.rerender();
    expect(view.result.current.history).toEqual([]);
  }
  state.session = original;
  view.rerender();
  expect(view.result.current.history).toHaveLength(1);
  providerClient = {};
  view.rerender();
  expect(view.result.current.history).toEqual([]);
  expect(view.result.current.local[0]).toBe(7); // The app was not remounted.
});

it('renders translated real identifiers and unknown outcomes without exposing local UI ids as ledger ids', () => {
  render(<PartyLayerLocaleProvider locale="tr"><RecentTransactions transactions={[{
    id: 'local-ui-only-id', partyId: 'alice', walletId: 'vala', networkId: 'canton:da-devnet',
    createdAt: 1, updatedAt: 2, status: 'unknown', receipt: { submittedAt: 1, commandId: 'real-command-id' },
  }]} /></PartyLayerLocaleProvider>);
  expect(screen.getByRole('region', { name: 'Son işlemler' }).textContent).toContain('İşlem sonucu bilinmiyor');
  expect(screen.getByText('real-command-id')).not.toBeNull();
  expect(screen.queryByText('local-ui-only-id')).toBeNull();
});

it('restores pending activity after remount and reconciles it without another wallet write', async () => {
  const values = new Map<string, string>();
  const journal = createTransactionJournal({ namespace: 'test:devnet', storage: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); },
  } });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <TransactionHistoryProvider client={state.client} session={state.session} journal={journal}>{children}</TransactionHistoryProvider>;
  const first = renderHook(() => useTransactionFlow(), { wrapper });
  await act(async () => { await first.result.current.submitTransaction({ signedTx: {} }, { commandId: 'original-command' }); });
  const id = first.result.current.transaction!.id;
  first.unmount();
  const confirm = vi.fn(async () => ({ status: 'confirmed' as const, updateId: 'ledger-update' }));
  const restored = renderHook(() => useTransactionFlow({ confirm }), { wrapper });
  expect(restored.result.current.transaction).toMatchObject({ id, status: 'unknown', restored: true, commandId: 'original-command' });
  expect(confirm).not.toHaveBeenCalled();
  const original = state.session;
  state.session = { ...original!, partyId: toPartyId('other') }; restored.rerender();
  expect(restored.result.current.transactions).toEqual([]);
  await expect(restored.result.current.reconcile(id)).rejects.toThrow(/belong/);
  state.session = original; restored.rerender();
  await act(async () => { await restored.result.current.reconcile(id); });
  expect(restored.result.current.transaction?.status).toBe('confirmed');
  expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
  expect(values.size).toBe(0); // Terminal activity is not persisted as trusted success.
});

it('lets another mounted flow reconcile the same shared record', async () => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <TransactionHistoryProvider client={state.client} session={state.session}>{children}</TransactionHistoryProvider>;
  const view = renderHook(() => ({ a: useTransactionFlow(), b: useTransactionFlow({ confirm: async () => ({ status: 'confirmed', updateId: 'ledger-id' }) }) }), { wrapper });
  await act(async () => { await view.result.current.a.submitTransaction({ signedTx: {} }); });
  expect(view.result.current.b.transactions).toHaveLength(1);
  await act(async () => { await view.result.current.b.reconcile(view.result.current.a.transaction!.id); });
  expect(view.result.current.a.transaction?.status).toBe('confirmed');
  expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
});

it('does not resurrect cleared history when a wallet response arrives late', async () => {
  let finish!: (value: { submittedAt: number }) => void;
  state.client.submitTransaction.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <TransactionHistoryProvider client={state.client} session={state.session}>{children}</TransactionHistoryProvider>;
  const view = renderHook(() => ({ flow: useTransactionFlow(), clear: useClearRecentTransactions() }), { wrapper });
  let pending!: Promise<unknown>;
  act(() => { pending = view.result.current.flow.submitTransaction({ signedTx: {} }); });
  await act(async () => { await Promise.resolve(); });
  act(() => { view.result.current.clear(); });
  await act(async () => { finish({ submittedAt: 1 }); await pending; });
  expect(view.result.current.flow.transactions).toEqual([]);
  expect(state.client.submitTransaction).toHaveBeenCalledTimes(1);
});
