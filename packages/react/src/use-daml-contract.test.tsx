// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useDamlContract } from './use-daml-contract';
import { partyLayerKeys } from './query-keys';

/** An arbitrary dApp-owned contract type. PartyLayer is schema-agnostic. */
interface MyContract {
  contractId: string;
  payload: { owner: string; amount: string };
}

const contract: MyContract = {
  contractId: '00abc',
  payload: { owner: 'party::owner-1', amount: '42' },
};

/**
 * Fresh QueryClient per call; retries off so error/loading tests are deterministic.
 * NOTE: only a QueryClientProvider, deliberately NO PartyLayerProvider. The hook
 * works here purely because it never touches the PartyLayer client (Model 2).
 */
function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useDamlContract (v2, dApp-supplied read fetcher, generic over T)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the TanStack query shape + alias (contract === data) on success', async () => {
    const reader = vi.fn().mockResolvedValue(contract);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDamlContract<MyContract>({ read: reader }), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    expect('data' in result.current).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.contract).toEqual(contract); // alias === data
    expect(result.current.data).toEqual(contract);
    // Generic typing flows through: payload is typed, not unknown.
    expect(result.current.contract?.payload.owner).toBe('party::owner-1');
  });

  it('queryFn calls the provided read fetcher with the AbortSignal (no PartyLayer client involved)', async () => {
    const reader = vi.fn().mockResolvedValue(contract);
    const { wrapper } = makeWrapper();
    // Renders with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result } = renderHook(() => useDamlContract<MyContract>({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('null contract (absent/archived): contract === null, isSuccess true (not an error)', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDamlContract<MyContract>({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.contract).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('ledger query failed');
    const reader = vi.fn().mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDamlContract<MyContract>({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.contract).toBeUndefined();
  });

  it('isPending toggles true while pending, then false', async () => {
    let resolve: (v: MyContract | null) => void = () => {};
    const reader = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDamlContract<MyContract>({ read: reader }), { wrapper });

    expect(result.current.isPending).toBe(true);
    act(() => resolve(contract));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('opaque key scopes the cache (different keys cache independently)', async () => {
    const readerA = vi.fn().mockResolvedValue(contract);
    const otherContract: MyContract = { contractId: '00def', payload: { owner: 'party::owner-2', amount: '7' } };
    const readerB = vi.fn().mockResolvedValue(otherContract);
    const { queryClient, wrapper } = makeWrapper();

    const a = renderHook(() => useDamlContract<MyContract>({ read: readerA, key: 'tmpl-A' }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    const b = renderHook(() => useDamlContract<MyContract>({ read: readerB, key: 'tmpl-B' }), { wrapper });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    // both fetchers ran (no cache collision between the two keys)
    expect(readerA).toHaveBeenCalledTimes(1);
    expect(readerB).toHaveBeenCalledTimes(1);
    // each cached under its own key-scoped queryKey
    expect(queryClient.getQueryData(partyLayerKeys.damlContract({ key: 'tmpl-A' }))).toEqual(contract);
    expect(queryClient.getQueryData(partyLayerKeys.damlContract({ key: 'tmpl-B' }))).toEqual(otherContract);
  });
});
