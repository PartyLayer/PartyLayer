// @vitest-environment jsdom
/**
 * useConnect tests: connect success, connect failure, and disconnect, mirroring the
 * react package's connect semantics. The client is a mock; no real wallet or RN
 * runtime is involved.
 *
 * The client is built ONCE per test and held in a variable rather than constructed
 * inside the render callback. A fresh client on every render reads as a client swap,
 * which resets the hook by design, and it also re-subscribes on every render. Real code
 * holds the client in module scope or a `useMemo`, which is what these mirror.
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
    const client = makeClient();
    const { result } = renderHook(() => useConnect(client));
    expect(result.current.session).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('connects: sets the session and status, resolves with the session', async () => {
    const connect = vi.fn().mockResolvedValue(session);
    const client = makeClient({ connect });
    const { result } = renderHook(() => useConnect(client));

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
    const client = makeClient({ connect });
    const { result } = renderHook(() => useConnect(client));

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
    const client = makeClient({ disconnect });
    const { result } = renderHook(() => useConnect(client));

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
