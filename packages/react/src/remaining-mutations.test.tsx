// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the client accessor so each hook gets a controllable mock client
// (the QueryClient is still real, via QueryClientProvider).
const mockDisconnect = vi.fn();
const mockSignMessage = vi.fn();
const mockSubmitTransaction = vi.fn();
vi.mock('./hooks', () => ({
  usePartyLayer: () => ({
    disconnect: mockDisconnect,
    signMessage: mockSignMessage,
    submitTransaction: mockSubmitTransaction,
  }),
}));

import { useDisconnect } from './use-disconnect';
import { useSignMessage } from './use-sign-message';
import { useSubmitTransaction } from './use-submit-transaction';

const signed = { signature: '0xsig', partyId: 'party::user', message: 'hi' } as never;
const receipt = { transactionHash: '0xtx', submittedAt: 1 } as never;

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDisconnect (v2 mutation)', () => {
  it('exposes mutation shape + aliases (disconnect/disconnectAsync)', () => {
    mockDisconnect.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDisconnect(), { wrapper });
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.disconnectAsync).toBe('function');
    expect(result.current.isPending).toBe(false);
  });

  it('disconnect() calls client.disconnect; isPending toggles; success', async () => {
    let resolve: () => void = () => {};
    mockDisconnect.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const { result } = renderHook(() => useDisconnect(), { wrapper });

    act(() => result.current.disconnect());
    await waitFor(() => expect(result.current.isPending).toBe(true));
    act(() => resolve());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(false);
  });

  it('disconnectAsync resolves (void) and throws on error', async () => {
    mockDisconnect.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDisconnect(), { wrapper });
    await act(async () => { await result.current.disconnectAsync(); });
    expect(mockDisconnect).toHaveBeenCalled();

    mockDisconnect.mockRejectedValue(new Error('disconnect failed'));
    const { result: r2 } = renderHook(() => useDisconnect(), { wrapper });
    await expect(act(async () => { await r2.current.disconnectAsync(); })).rejects.toThrow('disconnect failed');
  });

  it('surfaces an error via isError/error', async () => {
    const boom = new Error('disconnect failed');
    mockDisconnect.mockRejectedValue(boom);
    const { result } = renderHook(() => useDisconnect(), { wrapper });
    act(() => result.current.disconnect());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });
});

describe('useSignMessage (v2 mutation)', () => {
  const params = { message: 'hello' } as never;

  it('signMessage(params) calls client.signMessage with params; data surfaces', async () => {
    mockSignMessage.mockResolvedValue(signed);
    const { result } = renderHook(() => useSignMessage(), { wrapper });
    act(() => result.current.signMessage(params));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSignMessage).toHaveBeenCalledWith({ message: 'hello' });
    expect(result.current.data).toEqual(signed);
  });

  it('isPending toggles true while signing, then false', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockSignMessage.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useSignMessage(), { wrapper });
    act(() => result.current.signMessage(params));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    act(() => resolve(signed));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('signMessageAsync resolves with the SignedMessage and throws on error', async () => {
    mockSignMessage.mockResolvedValue(signed);
    const { result } = renderHook(() => useSignMessage(), { wrapper });
    let out: unknown;
    await act(async () => { out = await result.current.signMessageAsync(params); });
    expect(out).toEqual(signed);

    mockSignMessage.mockRejectedValue(new Error('sign failed'));
    const { result: r2 } = renderHook(() => useSignMessage(), { wrapper });
    await expect(act(async () => { await r2.current.signMessageAsync(params); })).rejects.toThrow('sign failed');
  });

  it('surfaces an error via isError/error', async () => {
    const boom = new Error('sign failed');
    mockSignMessage.mockRejectedValue(boom);
    const { result } = renderHook(() => useSignMessage(), { wrapper });
    act(() => result.current.signMessage(params));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });
});

describe('useSubmitTransaction (v2 mutation)', () => {
  const params = { signedTx: { commands: [] } } as never;

  it('submitTransaction(params) calls client.submitTransaction with params; data surfaces', async () => {
    mockSubmitTransaction.mockResolvedValue(receipt);
    const { result } = renderHook(() => useSubmitTransaction(), { wrapper });
    act(() => result.current.submitTransaction(params));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSubmitTransaction).toHaveBeenCalledWith({ signedTx: { commands: [] } });
    expect(result.current.data).toEqual(receipt);
  });

  it('isPending toggles true while submitting, then false', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockSubmitTransaction.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useSubmitTransaction(), { wrapper });
    act(() => result.current.submitTransaction(params));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    act(() => resolve(receipt));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('submitTransactionAsync resolves with the TxReceipt and throws on error', async () => {
    mockSubmitTransaction.mockResolvedValue(receipt);
    const { result } = renderHook(() => useSubmitTransaction(), { wrapper });
    let out: unknown;
    await act(async () => { out = await result.current.submitTransactionAsync(params); });
    expect(out).toEqual(receipt);

    mockSubmitTransaction.mockRejectedValue(new Error('submit failed'));
    const { result: r2 } = renderHook(() => useSubmitTransaction(), { wrapper });
    await expect(act(async () => { await r2.current.submitTransactionAsync(params); })).rejects.toThrow('submit failed');
  });

  it('surfaces an error via isError/error', async () => {
    const boom = new Error('submit failed');
    mockSubmitTransaction.mockRejectedValue(boom);
    const { result } = renderHook(() => useSubmitTransaction(), { wrapper });
    act(() => result.current.submitTransaction(params));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
  });
});
