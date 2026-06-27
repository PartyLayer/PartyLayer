// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useChoice } from './use-choice';

/** Arbitrary dApp-owned exercise variables and result. PartyLayer is schema-agnostic. */
interface MyVars {
  contractId: string;
  choice: string;
  argument: { amount: string };
}
interface MyResult {
  updateId: string;
  exerciseResult: { newContractId: string };
}

const vars: MyVars = { contractId: '00abc', choice: 'Transfer', argument: { amount: '42' } };
const result: MyResult = { updateId: '1220ff', exerciseResult: { newContractId: '00def' } };

/**
 * Fresh QueryClient per call; retries off so error tests are deterministic.
 * NOTE: only a QueryClientProvider, deliberately NO PartyLayerProvider and NO
 * ./hooks mock. useChoice works here purely because it never touches the PartyLayer
 * client (Model 2), unlike useSubmitTransaction.
 */
function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useChoice (v2 Model 2 mutation, generic over R/V)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the mutation shape + aliases (exerciseChoice/exerciseChoiceAsync)', () => {
    const exercise = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useChoice<MyResult, MyVars>({ exercise }), { wrapper });
    expect(typeof r.current.exerciseChoice).toBe('function');
    expect(typeof r.current.exerciseChoiceAsync).toBe('function');
    expect(typeof r.current.mutate).toBe('function');
    expect(r.current.isPending).toBe(false);
  });

  it('exerciseChoice(variables) calls the dApp exercise fetcher with the variables; data surfaces', async () => {
    const exercise = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useChoice<MyResult, MyVars>({ exercise }), { wrapper });

    act(() => r.current.exerciseChoice(vars));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(exercise).toHaveBeenCalledTimes(1);
    expect(exercise).toHaveBeenCalledWith(vars);
    expect(r.current.data).toEqual(result);
    // Generic typing flows through: exerciseResult is typed, not unknown.
    expect(r.current.data?.exerciseResult.newContractId).toBe('00def');
  });

  it('isPending toggles true while exercising, then false', async () => {
    let resolve: (v: MyResult) => void = () => {};
    const exercise = vi.fn().mockReturnValue(new Promise((res) => { resolve = res; }));
    const { result: r } = renderHook(() => useChoice<MyResult, MyVars>({ exercise }), { wrapper });

    act(() => r.current.exerciseChoice(vars));
    await waitFor(() => expect(r.current.isPending).toBe(true));
    act(() => resolve(result));
    await waitFor(() => expect(r.current.isPending).toBe(false));
    expect(r.current.isSuccess).toBe(true);
  });

  it('exerciseChoiceAsync resolves with the result and throws on error', async () => {
    const exercise = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useChoice<MyResult, MyVars>({ exercise }), { wrapper });
    let out: MyResult | undefined;
    await act(async () => { out = await r.current.exerciseChoiceAsync(vars); });
    expect(out).toEqual(result);

    const exerciseFail = vi.fn().mockRejectedValue(new Error('exercise failed'));
    const { result: r2 } = renderHook(() => useChoice<MyResult, MyVars>({ exercise: exerciseFail }), { wrapper });
    await expect(act(async () => { await r2.current.exerciseChoiceAsync(vars); })).rejects.toThrow('exercise failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('ledger exercise failed');
    const exercise = vi.fn().mockRejectedValue(boom);
    const { result: r } = renderHook(() => useChoice<MyResult, MyVars>({ exercise }), { wrapper });

    act(() => r.current.exerciseChoice(vars));
    await waitFor(() => expect(r.current.isError).toBe(true));
    expect(r.current.error).toBe(boom);
  });

  it('forwards pass-through mutation options (onSuccess fires with result + variables)', async () => {
    const onSuccess = vi.fn();
    const exercise = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(
      () => useChoice<MyResult, MyVars>({ exercise, mutation: { onSuccess } }),
      { wrapper },
    );
    act(() => r.current.exerciseChoice(vars));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(vars);
  });
});
