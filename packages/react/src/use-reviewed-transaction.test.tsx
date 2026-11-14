// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Session } from '@partylayer/core';
import { useReviewedTransaction, type OperationPreparationContext } from './use-reviewed-transaction';

const state = vi.hoisted(() => ({ session: null as Session | null,
  client: { getActiveSession: vi.fn(), submitTransaction: vi.fn() } }));
vi.mock('./context', () => ({ usePartyLayerContext: () => state }));
const input = () => ({ receiver: 'bob', amount: '1.1234567890' });
const prepare = vi.fn(async (_input: ReturnType<typeof input>, context: OperationPreparationContext) => ({
  parameters: { signedTx: { commandId: context.commandId, commands: [{ exercise: 'configured-by-app' }] } }, expiresAt: Date.now() + 60_000,
}));
const options = { networkId: 'canton:da-devnet', prepare };
beforeEach(() => {
  state.session = { sessionId: 's1', walletId: 'vala', partyId: 'alice', network: 'devnet', capabilitiesSnapshot: ['submitTransaction'] } as Session;
  state.client.getActiveSession.mockReset().mockImplementation(async () => state.session);
  state.client.submitTransaction.mockReset().mockResolvedValue({ submittedAt: 1, updateId: 'update' });
  prepare.mockClear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('requires explicit review and a second action, preserving the reviewed intent and original command id', async () => {
  const view = renderHook(() => useReviewedTransaction(options));
  await expect(view.result.current.submit()).rejects.toThrow(/Review/);
  const value = input();
  await act(async () => { await view.result.current.prepare(value); });
  value.amount = '999';
  expect(view.result.current.review?.input.amount).toBe('1.1234567890');
  expect(Object.isFrozen(view.result.current.review?.input)).toBe(true);
  expect(state.client.submitTransaction).not.toHaveBeenCalled();
  const commandId = prepare.mock.calls[0][1].commandId;
  await act(async () => { expect((await view.result.current.submit()).status).toBe('submitted'); });
  expect(state.client.submitTransaction).toHaveBeenCalledWith(expect.objectContaining({ signedTx: expect.objectContaining({ commandId }) }));
  expect(view.result.current.transaction?.commandId).toBe(commandId);
  await expect(view.result.current.submit()).rejects.toThrow(/Review/);
  expect(state.client.submitTransaction).toHaveBeenCalledOnce();
});

it('does not expose the internal prepared command or client through its public preparation result', async () => {
  const view = renderHook(() => useReviewedTransaction(options));
  await act(async () => {
    const result = await view.result.current.prepare(input());
    expect(Object.keys(result).sort()).toEqual(['expiresAt', 'input']);
    expect(Object.isFrozen(result)).toBe(true);
    expect('parameters' in result || 'client' in result || 'preparer' in result).toBe(false);
  });
  await act(async () => { await view.result.current.submit(); });
  expect(state.client.submitTransaction.mock.calls[0][0].signedTx.commands).toEqual([{ exercise: 'configured-by-app' }]);
});

it.each([new Date('2026-01-01'), { amount: Number.NaN }, { callback: () => {} }])('rejects non-JSON operation input instead of silently changing its value', async input => {
  const configured = vi.fn(async (_input: unknown, context: OperationPreparationContext) => ({
    parameters: { signedTx: { commandId: context.commandId } }, expiresAt: Date.now() + 60_000,
  }));
  const view = renderHook(() => useReviewedTransaction({ networkId: options.networkId, prepare: configured }));
  await act(async () => { await expect(view.result.current.prepare(input)).rejects.toThrow(/JSON/); });
  expect(configured).not.toHaveBeenCalled(); expect(state.client.submitTransaction).not.toHaveBeenCalled();
});

it.each(['disconnected', 'network', 'mismatch', 'capability', 'configuration'])('does not prepare unsupported %s operations', async kind => {
  if (kind === 'disconnected') state.session = null;
  else if (kind === 'network') state.session!.network = 'mainnet' as Session['network'];
  else if (kind === 'mismatch') state.session!.networkMismatch = { expected: 'canton:da-devnet', actual: 'canton:da-mainnet' };
  else if (kind === 'capability') state.session!.capabilitiesSnapshot = [];
  const view = renderHook(() => useReviewedTransaction({ ...options, prepare: kind === 'configuration' ? undefined : prepare }));
  expect(view.result.current.supported).toBe(false);
  await expect(view.result.current.prepare(input())).rejects.toThrow(/not configured/);
  expect(prepare).not.toHaveBeenCalled(); expect(state.client.submitTransaction).not.toHaveBeenCalled();
});

it.each(['command', 'expiry'])('rejects an unbound or expired prepared %s before any wallet write', async kind => {
  const broken = vi.fn(async (_input: ReturnType<typeof input>, context: OperationPreparationContext) => ({
    parameters: { signedTx: { commandId: kind === 'command' ? 'stale' : context.commandId } },
    expiresAt: kind === 'expiry' ? Date.now() - 1 : Date.now() + 60_000,
  }));
  const view = renderHook(() => useReviewedTransaction({ ...options, prepare: broken }));
  await act(async () => { await expect(view.result.current.prepare(input())).rejects.toThrow(/unbound|expiry/); });
  expect(view.result.current.review).toBeNull(); expect(state.client.submitTransaction).not.toHaveBeenCalled();
});

it('discards a prepared review on disconnect/reconnect with the same party and wallet', async () => {
  const view = renderHook(() => useReviewedTransaction(options));
  await act(async () => { await view.result.current.prepare(input()); });
  state.session = { ...state.session!, sessionId: 's2' as Session['sessionId'] }; view.rerender();
  expect(view.result.current.review).toBeNull();
  await expect(view.result.current.submit()).rejects.toThrow(/Review/);
  expect(state.client.submitTransaction).not.toHaveBeenCalled();
});

it('rejects a stale prepared operation when its preparation callback changes', async () => {
  let config = options;
  const view = renderHook(() => useReviewedTransaction(config));
  await act(async () => { await view.result.current.prepare(input()); });
  config = { ...options, prepare: vi.fn(prepare) }; view.rerender();
  expect(view.result.current.review).toBeNull();
  await expect(view.result.current.submit()).rejects.toThrow(/Review/);
  expect(state.client.submitTransaction).not.toHaveBeenCalled();
});

it('bounds preparation and ignores its late result without calling the wallet', async () => {
  let done!: (value: Awaited<ReturnType<typeof prepare>>) => void;
  const slow = vi.fn(() => new Promise<Awaited<ReturnType<typeof prepare>>>(resolve => { done = resolve; }));
  const view = renderHook(() => useReviewedTransaction({ ...options, prepare: slow, preparationTimeoutMs: 10 }));
  await act(async () => { await expect(view.result.current.prepare(input())).rejects.toThrow(/timed out/); });
  await act(async () => { done({ parameters: { signedTx: { commandId: 'late', commands: [] } }, expiresAt: Date.now() + 60_000 }); });
  expect(view.result.current.review).toBeNull(); expect(state.client.submitTransaction).not.toHaveBeenCalled();
});

it('consumes a review exactly once and preserves an unknown write outcome without retry', async () => {
  let reject!: (reason: unknown) => void;
  state.client.submitTransaction.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  const view = renderHook(() => useReviewedTransaction(options));
  await act(async () => { await view.result.current.prepare(input()); });
  let result!: ReturnType<typeof view.result.current.submit>;
  act(() => { result = view.result.current.submit(); });
  await waitFor(() => expect(state.client.submitTransaction).toHaveBeenCalledOnce());
  await expect(view.result.current.submit()).rejects.toThrow(/pending/);
  await act(async () => { reject(new Error('Response lost')); expect((await result).status).toBe('unknown'); });
  await expect(view.result.current.submit()).rejects.toThrow(/Review/);
  expect(state.client.submitTransaction).toHaveBeenCalledOnce();
});
