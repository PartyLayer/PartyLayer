// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the client accessor so the hook gets a controllable mock client
// (the QueryClient is still real, via QueryClientProvider).
const mockConnect = vi.fn();
vi.mock('./hooks', () => ({
  usePartyLayer: () => ({ connect: mockConnect }),
}));

import { useConnect } from './use-connect';

const session = { sessionId: 's1', walletId: 'console', partyId: 'party::user' } as never;

function wrapper({ children }: { children: React.ReactNode }) {
  // Fresh QueryClient per render; retries off so error tests are deterministic.
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useConnect (v2, TanStack mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the TanStack mutation shape + wagmi aliases (connect/connectAsync)', () => {
    mockConnect.mockResolvedValue(session);
    const { result } = renderHook(() => useConnect(), { wrapper });
    expect(typeof result.current.connect).toBe('function'); // === mutate
    expect(typeof result.current.connectAsync).toBe('function'); // === mutateAsync
    expect(typeof result.current.reset).toBe('function');
    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('connect() triggers the underlying client.connect with the given options', async () => {
    mockConnect.mockResolvedValue(session);
    const { result } = renderHook(() => useConnect(), { wrapper });

    act(() => {
      result.current.connect({ walletId: 'console' } as never);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledWith({ walletId: 'console' });
    expect(result.current.data).toEqual(session);
  });

  it('isPending toggles true while connecting, then false', async () => {
    let resolveConnect: (s: unknown) => void = () => {};
    mockConnect.mockReturnValue(new Promise((res) => { resolveConnect = res; }));
    const { result } = renderHook(() => useConnect(), { wrapper });

    act(() => {
      result.current.connect(undefined);
    });
    await waitFor(() => expect(result.current.isPending).toBe(true)); // toggled on
    act(() => resolveConnect(session));
    await waitFor(() => expect(result.current.isPending).toBe(false)); // toggled off
    expect(result.current.isSuccess).toBe(true);
  });

  it('connectAsync resolves with the session', async () => {
    mockConnect.mockResolvedValue(session);
    const { result } = renderHook(() => useConnect(), { wrapper });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.connectAsync(undefined);
    });
    expect(returned).toEqual(session);
  });

  it('surfaces an error: error state set, isError true (does not silently swallow)', async () => {
    const boom = new Error('connect rejected');
    mockConnect.mockRejectedValue(boom);
    const { result } = renderHook(() => useConnect(), { wrapper });

    act(() => {
      result.current.connect(undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.data).toBeUndefined();
  });

  it('connectAsync THROWS on error (unlike v1 which returned null)', async () => {
    const boom = new Error('connect rejected');
    mockConnect.mockRejectedValue(boom);
    const { result } = renderHook(() => useConnect(), { wrapper });

    await expect(
      act(async () => {
        await result.current.connectAsync(undefined);
      }),
    ).rejects.toThrow('connect rejected');
  });
});
