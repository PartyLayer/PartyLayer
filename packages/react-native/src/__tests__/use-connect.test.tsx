// @vitest-environment jsdom
/**
 * useConnect tests: connect success, connect failure, and disconnect, mirroring the
 * react package's connect semantics. The client is a mock; no real wallet or RN
 * runtime is involved.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { PartyLayerClient, Session } from '@partylayer/sdk';
import { useConnect } from '../use-connect';

const session = { sessionId: 's1', walletId: 'console', partyId: 'party::user' } as unknown as Session;

function makeClient(overrides: Partial<Record<string, unknown>> = {}): PartyLayerClient {
  return {
    getActiveSession: vi.fn().mockResolvedValue(null),
    connect: vi.fn().mockResolvedValue(session),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  } as unknown as PartyLayerClient;
}

describe('useConnect', () => {
  it('starts idle with no session', async () => {
    const { result } = renderHook(() => useConnect(makeClient()));
    expect(result.current.session).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('connects: sets the session and status, resolves with the session', async () => {
    const connect = vi.fn().mockResolvedValue(session);
    const { result } = renderHook(() => useConnect(makeClient({ connect })));

    let returned: Session | undefined;
    await act(async () => {
      returned = await result.current.connect({ walletId: 'console' } as never);
    });
    expect(connect).toHaveBeenCalledWith({ walletId: 'console' });
    expect(returned).toEqual(session);
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.session).toEqual(session);
    expect(result.current.status).toBe('connected');
  });

  it('surfaces a connect failure without swallowing it', async () => {
    const boom = new Error('connect rejected');
    const connect = vi.fn().mockRejectedValue(boom);
    const { result } = renderHook(() => useConnect(makeClient({ connect })));

    await act(async () => {
      await expect(result.current.connect(undefined)).rejects.toThrow('connect rejected');
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(boom);
    expect(result.current.session).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it('disconnects: clears the session', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useConnect(makeClient({ disconnect })));

    await act(async () => {
      await result.current.connect(undefined);
    });
    await waitFor(() => expect(result.current.isConnected).toBe(true));

    await act(async () => {
      await result.current.disconnect();
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.status).toBe('idle');
  });
});
