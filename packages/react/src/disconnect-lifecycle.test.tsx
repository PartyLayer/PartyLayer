// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryStorage, createSessionStore, type SessionStore } from '@partylayer/session';
import type { CIP0103Provider } from '@partylayer/core';
import type { PartyLayerClient } from '@partylayer/sdk';

const context = vi.hoisted(() => ({ value: {} as { client: PartyLayerClient; store: SessionStore | null } }));
vi.mock('./context', () => ({ usePartyLayerContext: () => context.value }));

import { useDisconnect as useBaseDisconnect } from './hooks';
import { useDisconnect as useQueryDisconnect } from './use-disconnect';

const cases = [
  { name: 'base hook', useHook: () => { const state = useBaseDisconnect(); return { run: state.disconnect, error: state.error }; } },
  { name: 'query hook', useHook: () => { const state = useQueryDisconnect(); return { run: state.disconnectAsync, error: state.error }; } },
];

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { context.value.store?.destroy(); vi.useRealTimers(); });

function setup(failure?: Error) {
  let connected = true;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const disconnect = vi.fn(async () => { if (failure) throw failure; connected = false; });
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'disconnect') {
      await disconnect();
      listeners.get('statusChanged')?.forEach(listener => listener({ connection: { isConnected: false } }));
      return null;
    }
    if (method === 'status') return { connection: { isConnected: connected }, network: { networkId: 'canton:devnet' } };
    if (method === 'listAccounts') return [{ primary: true, partyId: 'party::disconnect', networkId: 'canton:devnet' }];
    if (method === 'getActiveNetwork') return { networkId: 'canton:devnet' };
    return {};
  });
  const provider = {
    request,
    on(event: string, listener: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener); return provider;
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(listener); return provider;
    },
  } as unknown as CIP0103Provider;
  const store = createSessionStore(provider, {
    storage: createMemoryStorage(), persistSnapshot: false,
    reconnect: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, factor: 2, jitter: false },
  });
  context.value = { client: { disconnect } as unknown as PartyLayerClient, store };
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { store, disconnect, request, wrapper };
}

for (const { name, useHook } of cases) describe(name, () => {
  it('explicit logout tears down the owner once and does not schedule reconnect', async () => {
    const fixture = setup();
    await fixture.store.restore();
    expect(fixture.store.getSnapshot().status).toBe('connected');
    const { result } = renderHook(useHook, { wrapper: fixture.wrapper });
    await act(async () => { await result.current.run(); });
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    expect(fixture.store.getSnapshot().status).toBe('disconnected');
    const calls = fixture.request.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fixture.request.mock.calls).toHaveLength(calls);
    expect(result.current.error).toBeNull();
  });

  it('retains the async rejection and error state when provider teardown fails', async () => {
    const error = new Error('wallet disconnect failed');
    const fixture = setup(error);
    const { result } = renderHook(useHook, { wrapper: fixture.wrapper });
    await act(async () => { await expect(result.current.run()).rejects.toBe(error); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.error).toBe(error);
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
  });

  it('preserves the direct-client fallback when no shared store is provided', async () => {
    const fixture = setup();
    fixture.store.destroy(); context.value.store = null;
    const { result } = renderHook(useHook, { wrapper: fixture.wrapper });
    await act(async () => { await result.current.run(); });
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    expect(fixture.request).not.toHaveBeenCalled();
  });
});
