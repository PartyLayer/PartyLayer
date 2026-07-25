// @vitest-environment jsdom
/**
 * useWallets tests: loading, success (with derived icon data), and error, mirroring the
 * react package's useWallets semantics. The client is a mock; no real registry or RN
 * runtime is involved.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { PartyLayerClient, WalletInfo } from '@partylayer/sdk';
import { useWallets } from '../use-wallets';

const wallets = [
  { walletId: 'console', name: 'Console', website: 'https://c', icons: { md: 'https://x/console.svg' } },
  { walletId: 'walley', name: 'Walley', website: 'https://w', icons: { md: 'https://x/walley-logo.png' } },
] as unknown as WalletInfo[];

function makeClient(listWallets: ReturnType<typeof vi.fn>): PartyLayerClient {
  return { listWallets } as unknown as PartyLayerClient;
}

describe('useWallets', () => {
  it('starts loading, then resolves with wallets and derived icon data', async () => {
    const client = makeClient(vi.fn().mockResolvedValue(wallets));
    const { result } = renderHook(() => useWallets(client));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.wallets).toBeUndefined();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.wallets).toEqual(wallets);
    expect(result.current.walletIcons).toEqual([
      { walletId: 'console', url: 'https://x/console.svg', format: 'svg' },
      { walletId: 'walley', url: 'https://x/walley-logo.png', format: 'png' },
    ]);
  });

  it('forwards the filter to client.listWallets', async () => {
    const listWallets = vi.fn().mockResolvedValue(wallets);
    const client = makeClient(listWallets);
    const filter = { category: 'mobile' } as never;
    renderHook(() => useWallets(client, { filter }));
    await waitFor(() => expect(listWallets).toHaveBeenCalled());
    expect(listWallets).toHaveBeenCalledWith(filter);
  });

  it('surfaces an error without swallowing it', async () => {
    const boom = new Error('listWallets failed');
    const client = makeClient(vi.fn().mockRejectedValue(boom));
    const { result } = renderHook(() => useWallets(client));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.wallets).toBeUndefined();
  });

  it('refetch re-runs the load', async () => {
    const listWallets = vi.fn().mockResolvedValue(wallets);
    const client = makeClient(listWallets);
    const { result } = renderHook(() => useWallets(client));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listWallets).toHaveBeenCalledTimes(1);
    act(() => result.current.refetch());
    await waitFor(() => expect(listWallets).toHaveBeenCalledTimes(2));
  });
});
