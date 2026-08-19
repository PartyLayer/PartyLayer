// @vitest-environment jsdom
/**
 * useAccount, useSession, useAccountEffect and useDisconnect.
 *
 * The store hooks are driven through a CIP-0103 provider double faithful to the calls the
 * session store makes, so a connect here goes through the real store state machine rather
 * than a stubbed snapshot.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { PartyLayerClient } from '@partylayer/sdk';
import { PartyLayerProvider } from '../context';
import { useAccount, useSession, useAccountEffect } from '../session-hooks';
import { useDisconnect } from '../use-disconnect';
import { makeClient, ACCOUNT, NETWORK_ID } from './doubles';

vi.mock('react-native', () => ({
  Linking: { openURL: vi.fn(), addEventListener: vi.fn(() => ({ remove: vi.fn() })), getInitialURL: vi.fn(async () => null) },
}));

function wrapper(client: PartyLayerClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <PartyLayerProvider client={client}>{children}</PartyLayerProvider>;
  };
}

describe('useAccount', () => {
  it('starts disconnected and reports the account once connected', async () => {
    const client = makeClient();
    const { result } = renderHook(() => ({ account: useAccount(), session: useSession() }), {
      wrapper: wrapper(client),
    });

    // The provider's store runs init() on mount, which passes through `reconnecting`
    // before settling. Wait for it rather than racing it.
    await waitFor(() => expect(result.current.account.isDisconnected).toBe(true));
    expect(result.current.account.party).toBeNull();
    expect(result.current.account.chain).toBeNull();

    await act(async () => {
      await result.current.session.connect();
    });

    await waitFor(() => expect(result.current.account.isConnected).toBe(true));
    expect(result.current.account.party).toBe(ACCOUNT.partyId);
    // `address` is the parity alias of `party`, not a separate value.
    expect(result.current.account.address).toBe(ACCOUNT.partyId);
    expect(result.current.account.networkId).toBe(NETWORK_ID);
    expect(result.current.account.chain).toEqual({ id: NETWORK_ID });
  });

  it('throws outside a provider, naming the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAccount())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});

describe('useSession', () => {
  it('exposes the live state and stable actions', async () => {
    const client = makeClient();
    const { result, rerender } = renderHook(() => useSession(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.status).toBe('disconnected'));
    const firstConnect = result.current.connect;
    rerender();
    // Actions are memoized per store, so they are safe in a dependency array.
    expect(result.current.connect).toBe(firstConnect);

    await act(async () => {
      await result.current.connect();
    });
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.account?.partyId).toBe(ACCOUNT.partyId);

    await act(async () => {
      await result.current.disconnect();
    });
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
  });

  it('throws outside a provider, naming the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSession())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});

describe('useAccountEffect', () => {
  it('fires onConnect once with the account, then onDisconnect', async () => {
    const client = makeClient();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    const { result } = renderHook(
      () => {
        useAccountEffect({ onConnect, onDisconnect });
        return useSession();
      },
      { wrapper: wrapper(client) },
    );

    await act(async () => {
      await result.current.connect();
    });
    await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(1));
    expect(onConnect.mock.calls[0][0].account).toEqual(ACCOUNT);
    expect(onDisconnect).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.disconnect();
    });
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1));
    // Still exactly one connect: it fires once per session, not once per snapshot.
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('throws outside a provider, naming the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAccountEffect({}))).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});

describe('useDisconnect', () => {
  it('disconnects through an explicit client with NO provider', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({ disconnect });
    const { result } = renderHook(() => useDisconnect(client));

    await act(async () => {
      await result.current.disconnect();
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isDisconnecting).toBe(false);
  });

  it('reads the client from the provider', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({ disconnect });
    const { result } = renderHook(() => useDisconnect(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.disconnect();
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('records and rethrows a failure', async () => {
    const boom = new Error('disconnect refused');
    const client = makeClient({ disconnect: vi.fn().mockRejectedValue(boom) });
    const { result } = renderHook(() => useDisconnect(client));

    await act(async () => {
      await expect(result.current.disconnect()).rejects.toThrow('disconnect refused');
    });
    await waitFor(() => expect(result.current.error).toBe(boom));
    expect(result.current.isDisconnecting).toBe(false);
  });

  it('a disconnect resolving AFTER unmount sets no state', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveDisconnect: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });
    const client = makeClient({ disconnect: vi.fn().mockReturnValue(pending) });

    let renders = 0;
    const { result, unmount } = renderHook(() => {
      renders += 1;
      return useDisconnect(client);
    });
    act(() => {
      void result.current.disconnect();
    });
    const rendersAtUnmount = renders;

    unmount();
    await act(async () => {
      resolveDisconnect();
      await pending;
    });

    expect(renders).toBe(rendersAtUnmount);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('swapping the client clears the previous error', async () => {
    const failing = makeClient({ disconnect: vi.fn().mockRejectedValue(new Error('nope')) });
    const healthy = makeClient({ disconnect: vi.fn().mockResolvedValue(undefined) });

    const { result, rerender } = renderHook(
      ({ client }: { client: PartyLayerClient }) => useDisconnect(client),
      { initialProps: { client: failing } },
    );
    await act(async () => {
      await expect(result.current.disconnect()).rejects.toThrow('nope');
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender({ client: healthy });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('throws outside a provider when called with no client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useDisconnect())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});
