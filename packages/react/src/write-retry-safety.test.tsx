// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitTransaction } from './use-submit-transaction';
import { useChoice } from './use-choice';
import { useTransferInstruction } from './transfer-instruction';
import { useTransferInstructionAction } from './transfer-instruction-action';
import { useAllocationInstruction } from './allocation-instruction';
import { useAllocationAction } from './allocation-action';
import { useAllocationRequestAction } from './allocation-request-action';

const mock = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('./hooks', () => ({ usePartyLayer: () => ({ submitTransaction: mock.submit }) }));
afterEach(cleanup);
type Execute = (request: unknown) => Promise<unknown>;
const options = { retry: 3, retryDelay: 0 };
const cases: Array<{ name: string; useWrite: (submit: Execute, explicit: boolean) => () => Promise<unknown> }> = [
  { name: 'wallet submit', useWrite: (_submit, explicit) => {
    const mutation = useSubmitTransaction({ mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({ signedTx: {} });
  } },
  { name: 'Daml choice', useWrite: (submit, explicit) => {
    const mutation = useChoice({ exercise: submit, mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({});
  } },
  { name: 'token transfer', useWrite: (submit, explicit) => {
    const mutation = useTransferInstruction({ submit, mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({} as never);
  } },
  { name: 'transfer action', useWrite: (submit, explicit) => {
    const mutation = useTransferInstructionAction({ submit, mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({} as never);
  } },
  { name: 'allocation', useWrite: (submit, explicit) => {
    const mutation = useAllocationInstruction({ submit, mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({} as never);
  } },
  { name: 'allocation action', useWrite: (submit, explicit) => {
    const mutation = useAllocationAction({ submit, mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({} as never);
  } },
  { name: 'allocation request action', useWrite: (submit, explicit) => {
    const mutation = useAllocationRequestAction({ submit, mutation: explicit ? options : undefined });
    return () => mutation.mutateAsync({} as never);
  } },
];

describe.each(cases)('$name retry safety', ({ useWrite }) => {
  it.each([false, true])('does not replay a possibly accepted write (explicit retry: %s)', async explicit => {
    const failure = new Error('Ledger accepted; response was lost');
    const submit = vi.fn(async () => { throw failure; });
    mock.submit = submit;
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const view = renderHook(() => useWrite(submit, explicit), { wrapper });
    await act(async () => { await expect(view.result.current()).rejects.toBe(failure); });
    expect(submit).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
});
