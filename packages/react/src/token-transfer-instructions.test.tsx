// @vitest-environment jsdom
/**
 * useTransferInstructions tests: a CIP-0056 typed read hook for pending transfer
 * instructions, mirroring the token-holdings test. Covers: wraps the read fetcher
 * and exposes the TanStack shape plus an `instructions` alias; a resolved ref list
 * populates instructions; null yields instructions=null (success, not error); a
 * rejection yields isError; the queryKey folds in the opaque key so different keys
 * cache independently; enabled:false is respected; and the status union is
 * discriminated on `kind`. Model 2: rendered with only a QueryClientProvider.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useTransferInstructions,
  type TokenTransferInstructionRef,
} from './token-transfer-instructions';
import { partyLayerKeys } from './query-keys';

const instructions: TokenTransferInstructionRef[] = [
  {
    cid: 'ti-cid-1',
    instruction: {
      transfer: {
        sender: 'party::sender-1',
        receiver: 'party::receiver-1',
        amount: '25.00',
        instrumentId: { admin: 'party::registry-admin', id: 'USDC' },
        requestedAt: '2026-07-22T09:00:00Z',
        executeBefore: '2027-01-01T00:00:00Z',
        inputHoldingCids: ['00holdingA'],
        meta: { memo: 'lunch' },
      },
      status: { kind: 'pendingReceiverAcceptance' },
    },
  },
  {
    cid: 'ti-cid-2',
    instruction: {
      originalInstructionCid: 'ti-cid-0',
      transfer: {
        sender: 'party::sender-2',
        receiver: 'party::receiver-1',
        amount: '10.00',
        instrumentId: { admin: 'party::registry-admin', id: 'CC' },
        requestedAt: '2026-07-22T09:00:00Z',
        executeBefore: '2027-01-01T00:00:00Z',
        inputHoldingCids: [],
      },
      status: { kind: 'pendingInternalWorkflow', pendingActions: { 'party::registry-admin': 'sign' } },
    },
  },
];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useTransferInstructions (CIP-0056 typed instruction read, Model 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps the read fetcher and exposes the TanStack shape + alias (instructions === data)', async () => {
    const reader = vi.fn().mockResolvedValue(instructions);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferInstructions({ read: reader }), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.instructions).toEqual(instructions);
    expect(result.current.data).toEqual(instructions);
    expect(result.current.instructions?.[0].cid).toBe('ti-cid-1');
    expect(result.current.instructions?.[0].instruction.transfer.amount).toBe('25.00');
  });

  it('queryFn calls the read fetcher with the AbortSignal (no PartyLayer client involved)', async () => {
    const reader = vi.fn().mockResolvedValue(instructions);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferInstructions({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('discriminates the status union on kind (acceptance vs internal workflow)', async () => {
    const reader = vi.fn().mockResolvedValue(instructions);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferInstructions({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.instructions![0].instruction.status;
    const second = result.current.instructions![1].instruction.status;
    expect(first.kind).toBe('pendingReceiverAcceptance');
    expect(second.kind).toBe('pendingInternalWorkflow');
    // The internal-workflow variant carries pendingActions; the acceptance one does not.
    if (second.kind === 'pendingInternalWorkflow') {
      expect(second.pendingActions).toEqual({ 'party::registry-admin': 'sign' });
    }
  });

  it('null instructions (none yet/absent): instructions === null, isSuccess true (not an error)', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferInstructions({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.instructions).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('acs query failed');
    const reader = vi.fn().mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferInstructions({ read: reader }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.instructions).toBeUndefined();
  });

  it('isPending toggles true while pending, then false', async () => {
    let resolve: (v: TokenTransferInstructionRef[] | null) => void = () => {};
    const reader = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransferInstructions({ read: reader }), { wrapper });

    expect(result.current.isPending).toBe(true);
    act(() => resolve(instructions));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('opaque key scopes the cache (different keys cache independently)', async () => {
    const readerA = vi.fn().mockResolvedValue(instructions);
    const otherInstructions: TokenTransferInstructionRef[] = [
      {
        cid: 'ti-cid-9',
        instruction: {
          transfer: {
            sender: 'party::sender-9',
            receiver: 'party::receiver-2',
            amount: '7.00',
            instrumentId: { admin: 'party::registry-admin', id: 'CC' },
            requestedAt: '2026-07-22T09:00:00Z',
            executeBefore: '2027-01-01T00:00:00Z',
            inputHoldingCids: [],
          },
          status: { kind: 'pendingReceiverAcceptance' },
        },
      },
    ];
    const readerB = vi.fn().mockResolvedValue(otherInstructions);
    const { queryClient, wrapper } = makeWrapper();

    const a = renderHook(() => useTransferInstructions({ read: readerA, key: 'party-1' }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    const b = renderHook(() => useTransferInstructions({ read: readerB, key: 'party-2' }), { wrapper });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    expect(readerA).toHaveBeenCalledTimes(1);
    expect(readerB).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(partyLayerKeys.transferInstructions({ key: 'party-1' }))).toEqual(instructions);
    expect(queryClient.getQueryData(partyLayerKeys.transferInstructions({ key: 'party-2' }))).toEqual(otherInstructions);
  });

  it('respects passthrough query options (enabled:false does not fetch)', async () => {
    const reader = vi.fn().mockResolvedValue(instructions);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useTransferInstructions({ read: reader, query: { enabled: false } }),
      { wrapper },
    );
    expect(reader).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.instructions).toBeUndefined();
  });
});
