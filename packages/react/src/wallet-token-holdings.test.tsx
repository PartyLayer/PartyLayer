// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@partylayer/core';
import { useWalletTokenHoldings } from './wallet-token-holdings';

const state = vi.hoisted(() => ({ client: {} as object | null, session: null as Session | null, read: vi.fn(), factory: vi.fn(), applicationFactory: vi.fn() }));
vi.mock('./context', () => ({ usePartyLayerContext: () => state }));
vi.mock('@partylayer/sdk', () => ({
  createWalletLedgerReader: (...args: unknown[]) => { state.factory(...args); return { readHoldings: state.read }; },
  createApplicationLedgerReader: (...args: unknown[]) => { state.applicationFactory(...args); return { readHoldings: state.read }; },
}));
const options = { networkId: 'canton:da-devnet', holdingInterfaceId: 'pkg:Splice.Api.Token.HoldingV1:Holding' };
beforeEach(() => {
  state.client = {}; state.session = { sessionId: 's1', walletId: 'vala', partyId: 'alice', network: 'devnet' } as Session;
  state.factory.mockClear(); state.applicationFactory.mockClear(); state.read.mockReset().mockImplementation(async () => ({ walletId: state.session!.walletId, partyId: state.session!.partyId, networkId: options.networkId, offset: 123, holdings: [] }));
});
afterEach(cleanup);
function wrapper() { const q = new QueryClient(); return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={q}>{children}</QueryClientProvider>; }
it('reads through the SDK, scopes each query to its current source/account/network and forwards cancellation', async () => {
  const view = renderHook(() => useWalletTokenHoldings(options), { wrapper: wrapper() });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(view.result.current.snapshot).toMatchObject({ partyId: 'alice', networkId: options.networkId });
  expect(state.read.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  state.session = { ...state.session!, partyId: 'bob' as Session['partyId'] }; view.rerender();
  expect(view.result.current.holdings).toBeUndefined();
  await waitFor(() => expect(view.result.current.snapshot?.partyId).toBe('bob'));
  state.client = {}; view.rerender(); expect(view.result.current.holdings).toBeUndefined();
  await waitFor(() => expect(state.read).toHaveBeenCalledTimes(3));
});
it('does not read or expose previous data while disconnected or on the wrong network', async () => {
  const view = renderHook(() => useWalletTokenHoldings(options), { wrapper: wrapper() });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  state.session = { ...state.session!, network: 'mainnet' as Session['network'] }; view.rerender(); expect(view.result.current.holdings).toBeUndefined();
  state.session = null; view.rerender(); expect(view.result.current.holdings).toBeUndefined(); expect(state.read).toHaveBeenCalledOnce();
});
it('handles deferred client initialization and exposes errors instead of zero balances without retry', async () => {
  state.client = null; const view = renderHook(() => useWalletTokenHoldings(options), { wrapper: wrapper() }); expect(state.read).not.toHaveBeenCalled();
  state.read.mockRejectedValue(new Error('Forbidden')); state.client = {}; view.rerender();
  await waitFor(() => expect(view.result.current.isError).toBe(true)); expect(view.result.current.holdings).toBeUndefined(); expect(state.read).toHaveBeenCalledOnce();
});
it('selects the explicit application transport and isolates a changed source', async () => {
  let application = { endpoint: '/api/wallet-data', sourceId: 'source-a' };
  const view = renderHook(() => useWalletTokenHoldings({ ...options, application }), { wrapper: wrapper() });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(state.factory).not.toHaveBeenCalled(); expect(state.applicationFactory).toHaveBeenCalledWith(state.client, expect.objectContaining(application));
  application = { ...application, sourceId: 'source-b' }; view.rerender();
  expect(view.result.current.holdings).toBeUndefined(); await waitFor(() => expect(state.read).toHaveBeenCalledTimes(2));
});
