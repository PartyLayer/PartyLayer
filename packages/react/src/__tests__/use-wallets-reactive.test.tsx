// @vitest-environment jsdom
/**
 * Reactive useWallets — the React half of the announce race fix.
 *
 * (b) When the SDK emits 'wallets:changed' (a wallet announced late), the
 *     PartyLayerProvider re-lists and useWallets() re-renders with the new wallet
 *     — NO manual refresh. useWallets() stays a pure context read (signature
 *     untouched); it re-renders because the provider calls setWallets.
 * (g) Regression: with NO wallets:changed, the one-shot mount load + the existing
 *     session:connected behavior are unchanged (a dApp not using the new event
 *     sees today's exact behavior — listWallets called once on mount).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { createMockWallet } from '@partylayer/testing';
import type { PartyLayerClient, Session, WalletInfo } from '@partylayer/sdk';
import { PartyLayerProvider } from '../context';
import { useWallets } from '../hooks';

type Handler = (e: unknown) => void;

/** A fake client with a controllable wallet list + event bus (no SDK internals). */
function makeFakeClient() {
  const handlers = new Map<string, Set<Handler>>();
  let wallets: WalletInfo[] = [];
  const listWallets = vi.fn(async () => wallets);
  const client = {
    asProvider: () => createMockWallet(),
    getActiveSession: vi.fn(async () => null as Session | null),
    listWallets,
    getRegistryStatus: () => null,
    on: (event: string, h: Handler) => {
      let s = handlers.get(event);
      if (!s) {
        s = new Set();
        handlers.set(event, s);
      }
      s.add(h);
      return () => s!.delete(h);
    },
    // test drivers
    __setWallets: (w: WalletInfo[]) => {
      wallets = w;
    },
    __emit: (event: string, payload: unknown) => handlers.get(event)?.forEach((h) => h(payload)),
  };
  return client as typeof client & PartyLayerClient;
}

const wallet = (id: string): WalletInfo => ({ walletId: id, name: id } as unknown as WalletInfo);

function Probe() {
  const { wallets } = useWallets();
  return <div data-testid="ids">{wallets.map((w) => String(w.walletId)).join(',')}</div>;
}

describe('useWallets — reactive to wallets:changed', () => {
  it('(b) re-renders when a wallet announces late — no manual refresh', async () => {
    const client = makeFakeClient();
    client.__setWallets([]); // picker opens with nothing announced yet

    render(
      <PartyLayerProvider client={client}>
        <Probe />
      </PartyLayerProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe(''));

    // A late announce: the SDK would emit 'wallets:changed'; the provider re-lists.
    act(() => {
      client.__setWallets([wallet('browser:ext:latewallet')]);
      client.__emit('wallets:changed', { type: 'wallets:changed', reason: 'announced' });
    });

    await waitFor(() =>
      expect(screen.getByTestId('ids').textContent).toContain('browser:ext:latewallet'),
    );
  });

  it('(g) regression: without wallets:changed, the one-shot mount load is unchanged', async () => {
    const client = makeFakeClient();
    client.__setWallets([wallet('wallet:a')]);

    render(
      <PartyLayerProvider client={client}>
        <Probe />
      </PartyLayerProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('wallet:a'));
    // settle: no wallets:changed fired → exactly one (mount) listWallets, no re-list churn.
    await new Promise((r) => setTimeout(r, 60));
    expect(client.listWallets).toHaveBeenCalledTimes(1);
  });
});
