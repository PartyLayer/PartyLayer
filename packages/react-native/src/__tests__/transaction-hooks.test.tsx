// @vitest-environment jsdom
/**
 * Transaction hooks.
 *
 * The capability assertion is the important one: the hooks add no capability logic, so a
 * wallet missing a capability must surface the sdk's own CapabilityNotSupportedError
 * unchanged, by identity rather than by message.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { PartyLayerClient } from '@partylayer/sdk';
import { CapabilityNotSupportedError } from '@partylayer/core';
import { PartyLayerProvider } from '../context';
import {
  useSignMessage,
  useSignTransaction,
  useSubmitTransaction,
  useLedgerApi,
} from '../transaction-hooks';
import { makeClient } from './doubles';

vi.mock('react-native', () => ({
  Linking: { openURL: vi.fn(), addEventListener: vi.fn(() => ({ remove: vi.fn() })), getInitialURL: vi.fn(async () => null) },
}));

function wrapper(client: PartyLayerClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <PartyLayerProvider client={client}>{children}</PartyLayerProvider>;
  };
}

describe('useSignMessage', () => {
  it('signs through an explicit client with NO provider', async () => {
    const signMessage = vi.fn().mockResolvedValue({ signature: 'sig' });
    const client = makeClient({ signMessage });
    const { result } = renderHook(() => useSignMessage(client));

    let signed: unknown;
    await act(async () => {
      signed = await result.current.signMessage({ message: 'hi' } as never);
    });
    expect(signMessage).toHaveBeenCalledWith({ message: 'hi' });
    expect(signed).toEqual({ signature: 'sig' });
    expect(result.current.error).toBeNull();
    expect(result.current.isSigning).toBe(false);
  });

  it('reads the client from the provider', async () => {
    const signMessage = vi.fn().mockResolvedValue({ signature: 'sig' });
    const client = makeClient({ signMessage });
    const { result } = renderHook(() => useSignMessage(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.signMessage({ message: 'hi' } as never);
    });
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it('passes the sdk capability error through unchanged, by identity', async () => {
    // This is exactly what the client throws when the wallet does not advertise the
    // capability, so the hook must neither wrap nor replace it.
    const capabilityError = new CapabilityNotSupportedError('console', 'signMessage');
    const client = makeClient({ signMessage: vi.fn().mockRejectedValue(capabilityError) });
    const { result } = renderHook(() => useSignMessage(client));

    await act(async () => {
      await expect(result.current.signMessage({ message: 'hi' } as never)).rejects.toBe(
        capabilityError,
      );
    });
    await waitFor(() => expect(result.current.error).toBe(capabilityError));
    expect(result.current.error).toBeInstanceOf(CapabilityNotSupportedError);
  });

  it('reset clears a recorded error', async () => {
    const client = makeClient({ signMessage: vi.fn().mockRejectedValue(new Error('nope')) });
    const { result } = renderHook(() => useSignMessage(client));
    await act(async () => {
      await expect(result.current.signMessage({ message: 'x' } as never)).rejects.toThrow('nope');
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it('a sign resolving AFTER unmount sets no state', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveSign: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveSign = resolve;
    });
    const client = makeClient({ signMessage: vi.fn().mockReturnValue(pending) });

    let renders = 0;
    const { result, unmount } = renderHook(() => {
      renders += 1;
      return useSignMessage(client);
    });
    act(() => {
      void result.current.signMessage({ message: 'x' } as never);
    });
    const rendersAtUnmount = renders;

    unmount();
    await act(async () => {
      resolveSign({ signature: 'late' });
      await pending;
    });

    expect(renders).toBe(rendersAtUnmount);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('swapping the client clears the previous error', async () => {
    const failing = makeClient({ signMessage: vi.fn().mockRejectedValue(new Error('nope')) });
    const healthy = makeClient();
    const { result, rerender } = renderHook(
      ({ client }: { client: PartyLayerClient }) => useSignMessage(client),
      { initialProps: { client: failing } },
    );
    await act(async () => {
      await expect(result.current.signMessage({ message: 'x' } as never)).rejects.toThrow('nope');
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender({ client: healthy });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('throws outside a provider when called with no client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSignMessage())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});

describe('useSubmitTransaction', () => {
  it('submits and returns the receipt', async () => {
    const submitTransaction = vi.fn().mockResolvedValue({ transactionHash: '0xabc' });
    const client = makeClient({ submitTransaction });
    const { result } = renderHook(() => useSubmitTransaction(client));

    let receipt: unknown;
    await act(async () => {
      receipt = await result.current.submitTransaction({ commands: [] } as never);
    });
    expect(receipt).toEqual({ transactionHash: '0xabc' });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('passes the sdk capability error through unchanged', async () => {
    const capabilityError = new CapabilityNotSupportedError('console', 'submitTransaction');
    const client = makeClient({ submitTransaction: vi.fn().mockRejectedValue(capabilityError) });
    const { result } = renderHook(() => useSubmitTransaction(client));

    await act(async () => {
      await expect(result.current.submitTransaction({ commands: [] } as never)).rejects.toBe(
        capabilityError,
      );
    });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(CapabilityNotSupportedError));
  });

  it('throws outside a provider when called with no client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSubmitTransaction())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});

describe('useSignTransaction and useLedgerApi', () => {
  it('sign transaction succeeds and surfaces the capability error', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useSignTransaction(client));
    await act(async () => {
      await result.current.signTransaction({ commands: [] } as never);
    });
    expect(client.signTransaction).toHaveBeenCalledTimes(1);

    const capabilityError = new CapabilityNotSupportedError('console', 'signTransaction');
    const failing = makeClient({ signTransaction: vi.fn().mockRejectedValue(capabilityError) });
    const second = renderHook(() => useSignTransaction(failing));
    await act(async () => {
      await expect(second.result.current.signTransaction({ commands: [] } as never)).rejects.toBe(
        capabilityError,
      );
    });
  });

  it('ledger api succeeds and surfaces the capability error', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useLedgerApi(client));
    await act(async () => {
      await result.current.ledgerApi({ method: 'GET', path: '/v2/state' } as never);
    });
    expect(client.ledgerApi).toHaveBeenCalledTimes(1);

    const capabilityError = new CapabilityNotSupportedError('console', 'ledgerApi');
    const failing = makeClient({ ledgerApi: vi.fn().mockRejectedValue(capabilityError) });
    const second = renderHook(() => useLedgerApi(failing));
    await act(async () => {
      await expect(
        second.result.current.ledgerApi({ method: 'GET', path: '/v2/state' } as never),
      ).rejects.toBe(capabilityError);
    });
  });

  it('both throw outside a provider when called with no client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSignTransaction())).toThrow(/PartyLayerProvider/);
    expect(() => renderHook(() => useLedgerApi())).toThrow(/PartyLayerProvider/);
    spy.mockRestore();
  });
});
