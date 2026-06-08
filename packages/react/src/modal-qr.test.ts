// @vitest-environment jsdom
/**
 * Modal WalletConnect QR view:
 *  - a pure-remote (WalletConnect) wallet surfaces the in-modal QR view when the
 *    adapter emits a pairing URI (via connect opts.onDisplayUri), and
 *  - a dual-transport wallet (Console) keeps its existing extension + placeholder
 *    QR-fallback flow (no onDisplayUri / no WC-specific copy).
 *
 * Uses React.createElement (no JSX) — the package has no JSX test toolchain.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toWalletId } from '@partylayer/core';

const connectMock = vi.fn();

const WC_WALLET = {
  walletId: toWalletId('walletconnect'),
  name: 'WalletConnect',
  capabilities: ['connect', 'remoteSigner', 'deeplink', 'events'],
  icons: {},
  website: '',
  adapter: { packageName: 'builtin', versionRange: '*' },
  docs: [],
  networks: ['mainnet'],
};
const DUAL_WALLET = {
  walletId: toWalletId('console'),
  name: 'Console Wallet',
  capabilities: ['connect', 'injected', 'deeplink', 'remoteSigner'],
  icons: {},
  website: '',
  adapter: { packageName: 'builtin', versionRange: '*' },
  docs: [],
  networks: ['mainnet'],
};

vi.mock('./hooks', () => ({
  useWallets: () => ({ wallets: [WC_WALLET, DUAL_WALLET], isLoading: false }),
  useConnect: () => ({ connect: connectMock, error: null, reset: vi.fn() }),
  useRegistryStatus: () => ({ status: { verified: true }, refresh: vi.fn() }),
}));
vi.mock('./theme', () => ({
  useTheme: () => ({
    mode: 'light',
    fontFamily: 'sans-serif',
    colors: {
      background: '#fff',
      surface: '#fff',
      border: '#ccc',
      overlay: 'rgba(0,0,0,0.5)',
      text: '#000',
      textSecondary: '#666',
      primary: '#fc0',
      primaryHover: '#e6b800',
      success: '#0a0',
      error: '#f00',
      warning: '#fa0',
    },
  }),
}));
vi.mock('./kit', () => ({
  useWalletIcons: () => ({}),
  resolveWalletIcon: () => null,
}));
// Avoid pulling the full SDK (→ all builtin adapters → @console-wallet/dapp-sdk
// source) into the test; the modal only needs isCip0103Native.
vi.mock('@partylayer/sdk', () => ({
  isCip0103Native: (w: { cip0103?: { native?: boolean } }) => !!w?.cip0103?.native,
}));
vi.mock('qrcode', () => ({
  toString: vi.fn(async () => '<svg data-testid="wc-qr-svg"></svg>'),
}));

// eslint-disable-next-line import/first
import { WalletModal } from './modal';

function renderModal() {
  return render(
    createElement(WalletModal, { isOpen: true, onClose: () => {}, onConnect: () => {} }),
  );
}

afterEach(() => {
  connectMock.mockReset();
  cleanup();
});

describe('WalletModal — WalletConnect QR view', () => {
  it('surfaces the in-modal QR view for a pure-remote (WalletConnect) wallet', async () => {
    connectMock.mockImplementation(async (options: { onDisplayUri?: (u: string) => void }) => {
      // Simulate the WC adapter emitting a pairing URI during connect.
      options?.onDisplayUri?.('wc:abc123@2?relay-protocol=irn');
      return new Promise(() => {}); // never resolves → stays in QR view
    });

    renderModal();
    fireEvent.click(await screen.findByText('WalletConnect'));

    // wallet-agnostic copy for the generic WC entry
    expect(await screen.findByText('Scan with your Canton wallet')).toBeTruthy();
    expect(connectMock).toHaveBeenCalledTimes(1);
    const opts = connectMock.mock.calls[0][0] as { onDisplayUri?: unknown };
    expect(typeof opts.onDisplayUri).toBe('function');
    await waitFor(() => {
      expect(document.querySelector('[data-testid="wc-qr-svg"]')).toBeTruthy();
    });
  });

  it('keeps the dual-transport (Console) extension flow — no onDisplayUri, no WC copy', async () => {
    connectMock.mockImplementation(async () => new Promise(() => {}));

    renderModal();
    fireEvent.click(await screen.findByText('Console Wallet'));

    expect(connectMock).toHaveBeenCalledTimes(1);
    const opts = connectMock.mock.calls[0][0] as { onDisplayUri?: unknown };
    expect(opts.onDisplayUri).toBeUndefined();
    expect(screen.queryByText('Scan with your Canton wallet')).toBeNull();
  });
});
