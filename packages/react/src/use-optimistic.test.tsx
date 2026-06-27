// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { optimisticMutationOptions } from './use-optimistic';
import { useChoice } from './use-choice';

const KEY = ['my-app', 'contracts'] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('optimisticMutationOptions (the trio, direct)', () => {
  it('onMutate cancels, snapshots, optimistically updates, and returns the snapshot as context', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ['a']);
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');

    const opts = optimisticMutationOptions<string[], string>({
      queryClient,
      queryKey: KEY,
      update: (previous, variables) => [...(previous ?? []), variables],
    });

    // TanStack's lifecycle callbacks take a trailing framework context arg that is
    // irrelevant here; cast to the call shape we actually exercise.
    const onMutate = opts.onMutate as (variables: string) => Promise<{ previous: string[] | undefined }>;
    const context = await onMutate('b');
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(queryClient.getQueryData(KEY)).toEqual(['a', 'b']); // optimistic write applied
    expect(context).toEqual({ previous: ['a'] }); // snapshot returned for rollback
  });

  it('onError rolls back to the snapshot in context', () => {
    const queryClient = new QueryClient();
    const opts = optimisticMutationOptions<string[], string>({
      queryClient,
      queryKey: KEY,
      update: (previous) => previous ?? [],
    });
    queryClient.setQueryData(KEY, ['optimistic']); // pretend onMutate already wrote

    const onError = opts.onError as (
      error: Error,
      variables: string,
      context: { previous: string[] | undefined },
    ) => void;
    onError(new Error('boom'), 'b', { previous: ['original'] });
    expect(queryClient.getQueryData(KEY)).toEqual(['original']); // rolled back
  });

  it('onSettled invalidates by default, and skips invalidation when invalidate is false', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    type SettledFn = (data: unknown, error: Error | null, variables: string, context: unknown) => void;
    (optimisticMutationOptions({ queryClient, queryKey: KEY, update: (p) => p }).onSettled as SettledFn)(
      undefined, null, 'b', undefined,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });

    invalidateSpy.mockClear();
    (optimisticMutationOptions({ queryClient, queryKey: KEY, update: (p) => p, invalidate: false })
      .onSettled as SettledFn)(undefined, null, 'b', undefined);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('optimisticMutationOptions spread into a mutation hook (useChoice end to end)', () => {
  function wrapperFor(queryClient: QueryClient) {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  it('optimistically updates the dApp query, then rolls back automatically when the exercise fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(KEY, ['existing']);
    const exercise = vi.fn().mockRejectedValue(new Error('exercise failed'));

    const { result } = renderHook(
      () =>
        useChoice<unknown, string>({
          exercise,
          // The spread proves there is no context-type friction with the hook.
          mutation: optimisticMutationOptions<string[], string>({
            queryClient,
            queryKey: KEY,
            update: (previous, variables) => [...(previous ?? []), variables],
          }),
        }),
      { wrapper: wrapperFor(queryClient) },
    );

    act(() => {
      result.current.exerciseChoice('new');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(exercise).toHaveBeenCalledWith('new');
    expect(queryClient.getQueryData(KEY)).toEqual(['existing']); // rolled back, no 'new'
  });

  it('keeps the optimistic value when the exercise succeeds', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    queryClient.setQueryData(KEY, ['existing']);
    const exercise = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(
      () =>
        useChoice<{ ok: boolean }, string>({
          exercise,
          mutation: optimisticMutationOptions<string[], string>({
            queryClient,
            queryKey: KEY,
            update: (previous, variables) => [...(previous ?? []), variables],
          }),
        }),
      { wrapper: wrapperFor(queryClient) },
    );

    act(() => {
      result.current.exerciseChoice('new');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // No queryFn registered for KEY, so onSettled's invalidation does not refetch:
    // the optimistic value stands.
    expect(queryClient.getQueryData(KEY)).toEqual(['existing', 'new']);
  });
});
