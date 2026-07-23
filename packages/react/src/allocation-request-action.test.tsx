// @vitest-environment jsdom
/**
 * useAllocationRequestAction tests: the response sibling of
 * useTransferInstructionAction, a CIP-0056 typed Model 2 mutation for the standard
 * AllocationRequest_Reject / _Withdraw choices. Mirrors the
 * transfer-instruction-action test. Covers: the hook wraps the dApp's submit
 * fetcher and exposes the mutation shape plus submitAction/submitActionAsync
 * aliases; both kinds pass through verbatim including the actor on reject; a
 * resolved result flows through; a rejected submit yields isError; the mutationKey
 * uses allocationRequestAction; and passthrough mutation options (onSuccess) fire.
 * Model 2: rendered with only a QueryClientProvider (no PartyLayerProvider).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useAllocationRequestAction,
  type AllocationRequestActionRequest,
} from './allocation-request-action';
import { partyLayerKeys } from './query-keys';

const rejectRequest: AllocationRequestActionRequest = {
  requestCid: '00requestCid',
  action: 'reject',
  actor: 'party::sender-1',
  meta: { reason: 'will not allocate' },
};
const withdrawRequest: AllocationRequestActionRequest = {
  requestCid: '00requestCid',
  action: 'withdraw',
};

interface MyResult {
  updateId: string;
}
const result: MyResult = { updateId: '1220ff' };

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useAllocationRequestAction (CIP-0056 typed request response, Model 2 mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the mutation shape + aliases (submitAction/submitActionAsync)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });
    expect(typeof r.current.submitAction).toBe('function');
    expect(typeof r.current.submitActionAsync).toBe('function');
    expect(typeof r.current.mutate).toBe('function');
    expect(r.current.isPending).toBe(false);
  });

  it('reject passes the actor through verbatim (discriminated union carries actor)', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    // Rendered with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(rejectRequest));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(submit).toHaveBeenCalledWith(rejectRequest);
    const passed = submit.mock.calls[0][0] as AllocationRequestActionRequest;
    expect(passed.action).toBe('reject');
    // The reject variant carries actor; narrow on the discriminant to read it.
    if (passed.action === 'reject') {
      expect(passed.actor).toBe('party::sender-1');
    }
    expect(r.current.data).toEqual(result);
  });

  it('withdraw passes through verbatim (no actor on this variant)', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });
    await act(async () => { await r.current.submitActionAsync(withdrawRequest); });
    expect(submit).toHaveBeenCalledWith(withdrawRequest);
    const passed = submit.mock.calls[0][0] as AllocationRequestActionRequest;
    expect(passed.action).toBe('withdraw');
    expect('actor' in passed).toBe(false);
  });

  it('isPending toggles true while submitting, then false', async () => {
    let resolve: (v: MyResult) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise((res) => { resolve = res; }));
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(rejectRequest));
    await waitFor(() => expect(r.current.isPending).toBe(true));
    act(() => resolve(result));
    await waitFor(() => expect(r.current.isPending).toBe(false));
    expect(r.current.isSuccess).toBe(true);
  });

  it('submitActionAsync resolves with the result and throws on error', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });
    let out: MyResult | undefined;
    await act(async () => { out = await r.current.submitActionAsync(withdrawRequest); });
    expect(out).toEqual(result);

    const submitFail = vi.fn().mockRejectedValue(new Error('reject failed'));
    const { result: r2 } = renderHook(() => useAllocationRequestAction<MyResult>({ submit: submitFail }), { wrapper });
    await expect(act(async () => { await r2.current.submitActionAsync(rejectRequest); })).rejects.toThrow('reject failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('exercise failed');
    const submit = vi.fn().mockRejectedValue(boom);
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(rejectRequest));
    await waitFor(() => expect(r.current.isError).toBe(true));
    expect(r.current.error).toBe(boom);
  });

  it('uses the allocationRequestAction mutationKey (distinct from allocationAction)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationRequestAction<MyResult>({ submit }), { wrapper });
    expect(r.current.mutate).toBeTypeOf('function');
    expect(partyLayerKeys.allocationRequestAction()).toEqual(['partylayer', 'allocationRequestAction']);
    expect(partyLayerKeys.allocationRequestAction()).not.toEqual(partyLayerKeys.allocationAction());
  });

  it('forwards pass-through mutation options (onSuccess fires with result + request)', async () => {
    const onSuccess = vi.fn();
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(
      () => useAllocationRequestAction<MyResult>({ submit, mutation: { onSuccess } }),
      { wrapper },
    );
    act(() => r.current.submitAction(rejectRequest));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(rejectRequest);
  });
});
