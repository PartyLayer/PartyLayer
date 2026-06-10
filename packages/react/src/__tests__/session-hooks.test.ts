// @vitest-environment jsdom
/**
 * Step 6b hook tests — useAccount / useAccountEffect against the
 * @partylayer/testing mock, plus a backward-compat check that the existing
 * SDK-layer useSession still behaves as before. No DevNet, no live wallet.
 */

import { describe, it, expect, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { createMockWallet } from '@partylayer/testing';
import type { CIP0103Provider } from '@partylayer/core';
import type { PartyLayerClient } from '@partylayer/sdk';
import { PartyLayerProvider } from '../context';
import { useAccount, useAccountEffect, useSession } from '../session-hooks';
import { useClientSession } from '../hooks';

const STATUS_CHANGED = 'statusChanged';
const ACCOUNTS_CHANGED = 'accountsChanged';

function mkAccount(partyId: string, primary = true) {
  return {
    primary,
    partyId,
    status: 'allocated' as const,
    hint: '',
    publicKey: '',
    namespace: '',
    networkId: 'canton:da-devnet',
    signingProviderId: '',
  };
}

/**
 * Minimal fake PartyLayerClient: only what PartyLayerProvider touches —
 * asProvider() (our store's provider), getActiveSession/listWallets (load),
 * and on() (event subscriptions). Everything else is unused here.
 */
function fakeClient(
  provider: CIP0103Provider,
  overrides: Partial<{
    getActiveSession: () => Promise<unknown>;
    on: (event: string, handler: (e: unknown) => void) => () => void;
  }> = {},
): PartyLayerClient {
  return {
    asProvider: () => provider,
    getActiveSession: overrides.getActiveSession ?? (async () => null),
    listWallets: async () => [],
    on: overrides.on ?? (() => () => {}),
  } as unknown as PartyLayerClient;
}

function wrapperFor(client: PartyLayerClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(PartyLayerProvider, { client }, children);
  };
}

/** A WC-style provider whose status omits `network` but answers getActiveNetwork. */
function networklessConnectedProvider(networkId = 'canton:da-mainnet'): CIP0103Provider {
  const bus = new Map<string, Set<(...a: unknown[]) => void>>();
  const fire = (e: string, ...a: unknown[]) => bus.get(e)?.forEach((f) => f(...a));
  const p: CIP0103Provider = {
    async request<T>(args: { method: string }): Promise<T> {
      switch (args.method) {
        case 'status':
          return {
            connection: { isConnected: true },
            provider: { id: 'wc', version: '1', providerType: 'remote' },
          } as T;
        case 'listAccounts':
          return [mkAccount('party::wc')] as T;
        case 'getActiveNetwork':
          return { networkId } as T;
        default:
          return undefined as T;
      }
    },
    on(e, l) {
      let s = bus.get(e);
      if (!s) {
        s = new Set();
        bus.set(e, s);
      }
      s.add(l as (...a: unknown[]) => void);
      return p;
    },
    emit(e, ...a) {
      fire(e, ...a);
      return true;
    },
    removeListener(e, l) {
      bus.get(e)?.delete(l as (...a: unknown[]) => void);
      return p;
    },
  };
  return p;
}

describe('useAccount', () => {
  it('starts disconnected, reflects connect → connected + account, then disconnect', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(fakeClient(provider)),
    });

    // Let the mount init()/restore() settle to disconnected first (it probes
    // provider.status()); only then drive a connect, to avoid a test-only race.
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    expect(result.current.address).toBeNull();

    await act(async () => {
      await provider.request({ method: 'connect' });
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.party).toBe('party::mock-1');
    expect(result.current.address).toBe('party::mock-1'); // wagmi-parity alias
    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.networkId).toEqual(expect.stringContaining('canton:'));
    expect(result.current.chain?.id).toBe(result.current.networkId);

    await act(async () => {
      await provider.request({ method: 'disconnect' });
    });

    expect(result.current.isDisconnected).toBe(true);
    expect(result.current.account).toBeNull();
  });

  it('reflects accountsChanged (active + available accounts update)', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(fakeClient(provider)),
    });
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    await act(async () => {
      await provider.request({ method: 'connect' });
    });

    act(() => {
      provider.emit(ACCOUNTS_CHANGED, [
        mkAccount('party::switched', true),
        mkAccount('party::second', false),
      ]);
    });

    expect(result.current.accounts).toHaveLength(2);
    expect(result.current.party).toBe('party::switched');
  });

  it('populates networkId via the getActiveNetwork fallback (WC: status omits network)', async () => {
    // The store's init() (restore) runs on mount; restore() hits the fallback.
    const { result } = renderHook(() => useAccount(), {
      wrapper: wrapperFor(fakeClient(networklessConnectedProvider('canton:da-mainnet'))),
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.networkId).toBe('canton:da-mainnet');
  });

  it('does not re-render on a no-op status event (stable snapshot, no loop)', async () => {
    const provider = createMockWallet();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useAccount();
      },
      { wrapper: wrapperFor(fakeClient(provider)) },
    );

    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    await act(async () => {
      await provider.request({ method: 'connect' });
    });
    expect(result.current.isConnected).toBe(true);
    const rendersAfterConnect = renders;

    // Re-emit an identical connected status — no field changes → no re-render.
    act(() => {
      provider.emit(STATUS_CHANGED, {
        connection: { isConnected: true },
        provider: { id: 'mock', version: '0', providerType: 'browser' },
      });
    });

    expect(renders).toBe(rendersAfterConnect);
  });
});

describe('useAccountEffect', () => {
  it('fires onConnect once on connect and onDisconnect once on disconnect', async () => {
    const provider = createMockWallet();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const { result } = renderHook(
      () => {
        useAccountEffect({ onConnect, onDisconnect });
        return useAccount();
      },
      { wrapper: wrapperFor(fakeClient(provider)) },
    );

    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    await act(async () => {
      await provider.request({ method: 'connect' });
    });
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect.mock.calls[0][0].account?.partyId).toBe('party::mock-1');
    expect(onDisconnect).not.toHaveBeenCalled();

    await act(async () => {
      await provider.request({ method: 'disconnect' });
    });
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledTimes(1); // not fired again
  });

  it('does not fire onConnect for a no-op status re-emit', async () => {
    const provider = createMockWallet();
    const onConnect = vi.fn();
    const { result } = renderHook(
      () => {
        useAccountEffect({ onConnect });
        return useAccount();
      },
      { wrapper: wrapperFor(fakeClient(provider)) },
    );
    await waitFor(() => expect(result.current.isDisconnected).toBe(true));
    await act(async () => {
      await provider.request({ method: 'connect' });
    });
    expect(onConnect).toHaveBeenCalledTimes(1);

    act(() => {
      provider.emit(STATUS_CHANGED, {
        connection: { isConnected: true },
        provider: { id: 'mock', version: '0', providerType: 'browser' },
      });
    });
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});

// M1-S4: the legacy SDK-layer getter is preserved VERBATIM under useClientSession.
describe('useClientSession (legacy SDK-layer getter) — behavior preserved under new name', () => {
  it('still returns the SDK session from context, independent of the new store', async () => {
    const provider = createMockWallet();
    const handlers: Record<string, (e: unknown) => void> = {};
    const sdkSession = { sessionId: 'sdk-1', walletId: 'console', partyId: 'party::sdk' };

    const client = fakeClient(provider, {
      on: (event, handler) => {
        handlers[event] = handler;
        return () => delete handlers[event];
      },
    });

    const { result } = renderHook(() => useClientSession(), { wrapper: wrapperFor(client) });

    // Initially null (load() resolved getActiveSession → null).
    await waitFor(() => expect(result.current).toBeNull());

    // The SDK-layer event still drives it (unchanged behavior).
    act(() => {
      handlers['session:connected']?.({ type: 'session:connected', session: sdkSession });
    });

    expect(result.current).toEqual(sdkSession);
  });
});

// M1-S4: the NEW useSession is the reactive session-store hook.
describe('useSession (M1-S4 reactive session-store hook)', () => {
  it('exposes reactive SessionState + bound actions; reflects connect/disconnect', async () => {
    const provider = createMockWallet();
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(fakeClient(provider)) });

    await waitFor(() => expect(result.current.status).toBe('disconnected'));
    expect(result.current.isDisconnected).toBe(true);
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.restore).toBe('function');
    expect(typeof result.current.on).toBe('function');

    act(() => {
      provider.emit(STATUS_CHANGED, { connection: { isConnected: true }, network: { networkId: 'canton:da-mainnet' } });
      provider.emit(ACCOUNTS_CHANGED, [mkAccount('party::live')]);
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.isConnected).toBe(true);
    expect(result.current.account?.partyId).toBe('party::live');
    expect(result.current.networkId).toBe('canton:da-mainnet');

    act(() => {
      provider.emit(STATUS_CHANGED, { connection: { isConnected: false } });
    });
    await waitFor(() => expect(result.current.status).toBe('disconnected'));
  });

  it('SSR-safe: getServerSnapshot is the stable disconnected snapshot; actions never throw', () => {
    // useSession feeds getDisconnectedSnapshot as getServerSnapshot (no window /
    // BroadcastChannel access on the server). Here we assert the safety contract:
    // every action is callable and resolves/returns without throwing.
    const provider = createMockWallet();
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(fakeClient(provider)) });
    expect(['disconnected', 'reconnecting']).toContain(result.current.status); // mount restore may be in-flight
    expect(result.current.disconnect()).toBeInstanceOf(Promise);
    expect(result.current.connect()).toBeInstanceOf(Promise);
    expect(result.current.restore()).toBeInstanceOf(Promise);
    const off = result.current.on('party:changed', () => {});
    expect(typeof off).toBe('function');
    off();
  });
});

describe('useAccountEffect — onPartyChanged (M1-S4)', () => {
  it('fires onPartyChanged on a primary-party switch', async () => {
    const provider = createMockWallet();
    const onPartyChanged = vi.fn();
    renderHook(() => useAccountEffect({ onPartyChanged }), { wrapper: wrapperFor(fakeClient(provider)) });

    // establish a primary, then switch it
    act(() => {
      provider.emit(STATUS_CHANGED, { connection: { isConnected: true }, network: { networkId: 'canton:da-mainnet' } });
      provider.emit(ACCOUNTS_CHANGED, [mkAccount('party::a')]);
    });
    act(() => {
      provider.emit(ACCOUNTS_CHANGED, [mkAccount('party::b')]); // switch a → b
    });
    await waitFor(() =>
      expect(onPartyChanged).toHaveBeenCalledWith({ previous: 'party::a', current: 'party::b' }),
    );
  });
});
