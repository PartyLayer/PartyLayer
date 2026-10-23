// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { toPartyId, toWalletId, type Session } from '@partylayer/core';
import { TransactionHistoryProvider, RecentTransactions, useRecentTransactions } from './transaction-history';
import { useTransactionFlow } from './use-transaction-flow';
import { PartyLayerLocaleProvider } from './localization';

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
