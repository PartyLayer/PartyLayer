// @vitest-environment jsdom
/**
 * Wallet-picker classification lock-down + truth table.
 *
 * Drives the REAL WalletModal: for each of the eight stable-registry wallets it
 * clicks the entry, makes connect fail with WALLET_NOT_INSTALLED (the wallet-absent
 * case), and asserts which view the picker shows. The bar, from the ecosystem
 * convention (RainbowKit gates its install affordance on a declared browser
 * extension), is: a wallet that is NEVER a browser extension must never be told to
 * install one; it gets the path it actually supports.
 *
 * The WalletInfo shapes below match what registry-client's registryEntryToWalletInfo
 * produces for the stable entries (metadata.transport + the injected/deeplink/
 * remoteSigner capability tokens), verified against packages/registry-client/src/
 * schema.ts. React.createElement (no JSX) matches the package's test toolchain.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { toWalletId } from '@partylayer/core';

function w(
  id: string,
  name: string,
  transport: string,
  transportCaps: string[],
  extra: Record<string, unknown> = {},
) {
  return {
    walletId: toWalletId(id),
    name,
    capabilities: ['connect', 'disconnect', 'signMessage', ...transportCaps],
    icons: {},
    website: '',
    adapter: { packageName: 'builtin', versionRange: '*' },
    docs: [],
    networks: ['devnet'],
    metadata: { transport },
    ...extra,
  };
}

// The eight stable wallets, by their real registry-derived shape.
const WALLETS = [
  w('console', 'Console Wallet', 'extensionMobile', ['injected', 'deeplink', 'remoteSigner'], { cip0103: { native: true } }),
  w('send', 'Send', 'extension', ['injected'], { cip0103: { native: true } }),
  w('nightly', 'Nightly', 'extension', ['injected']),
  w('cantor8', 'Cantor8', 'mobile', ['deeplink']),
  w('loop', '5N Loop', 'scan', []),
  w('bron', 'Bron', 'enterprise', []),
  w('walletconnect', 'WalletConnect', 'mobile', ['deeplink', 'remoteSigner'], { cip0103: { native: false } }),
  w('walley', 'Walley', 'popup', [], { cip0103: { native: true } }),
  // A future entry with a novel installation shape and NO extension signal must
  // default to the unavailable view, never the install prompt.
  w('futurewallet', 'FutureWallet', 'somethingnew', []),
];

vi.mock('./hooks', () => ({
  useWallets: () => ({ wallets: WALLETS, isLoading: false }),
  useConnect: () => {
    const [error, setError] = useState<Error | null>(null);
    return {
      connect: async () => {
        setError(Object.assign(new Error('not installed'), { code: 'WALLET_NOT_INSTALLED' }));
        return null;
      },
      error,
      reset: () => setError(null),
    };
  },
  useRegistryStatus: () => ({ status: { verified: true }, refresh: vi.fn() }),
}));
vi.mock('./theme', () => ({
  useTheme: () => ({
    mode: 'light',
    fontFamily: 'sans-serif',
    colors: {
      background: '#fff', surface: '#fff', border: '#ccc', overlay: 'rgba(0,0,0,0.5)',
      text: '#000', textSecondary: '#666', primary: '#fc0', primaryHover: '#e6b800',
      success: '#0a0', error: '#f00', warning: '#fa0',
    },
  }),
}));
vi.mock('./kit', () => ({
  useWalletIcons: () => ({}),
  resolveWalletIcon: () => null,
  useWalletOrder: () => null,
  useAttribution: () => null,
}));
vi.mock('@partylayer/sdk', () => ({
  isCip0103Native: (x: { cip0103?: { native?: boolean } }) => !!x?.cip0103?.native,
}));
vi.mock('qrcode', () => ({ toString: vi.fn(async () => '<svg></svg>') }));

// eslint-disable-next-line import/first
import { WalletModal } from './modal';

afterEach(cleanup);

function openAndClick(name: string) {
  render(createElement(WalletModal, { isOpen: true, onClose: () => {}, onConnect: () => {} }));
  fireEvent.click(screen.getByText(name));
}

const INSTALL_PROMPT = /browser extension isn't installed/i;

describe('picker classification: browser-extension wallets show the install prompt', () => {
  it.each([['Send'], ['Nightly']])('%s (extension, absent) → install prompt', async (name) => {
    openAndClick(name);
    expect(await screen.findByText(INSTALL_PROMPT)).toBeTruthy();
  });
});

describe('picker classification: non-extension wallets NEVER show an install prompt', () => {
  it('Cantor8 (deep link) → mobile-wallet view, no install prompt', async () => {
    openAndClick('Cantor8');
    expect(await screen.findByText(/is a mobile wallet/i)).toBeTruthy();
    expect(screen.queryByText(INSTALL_PROMPT)).toBeNull();
  });

  it('WalletConnect (remote) → pairing view, no install prompt', async () => {
    openAndClick('WalletConnect');
    expect(await screen.findByText(/pair with walletconnect/i)).toBeTruthy();
    expect(screen.queryByText(INSTALL_PROMPT)).toBeNull();
  });

  it.each([['5N Loop'], ['Bron'], ['Walley'], ['FutureWallet']])(
    '%s (SDK / discovery / oauth / novel) → configuration view, no install prompt',
    async (name) => {
      openAndClick(name);
      expect(await screen.findByText(/is not available here/i)).toBeTruthy();
      expect(screen.queryByText(INSTALL_PROMPT)).toBeNull();
    },
  );
});

describe('picker classification: dual-transport wallet falls back, not "install"', () => {
  it('Console (extension + mobile) → does NOT show the install prompt (QR fallback)', async () => {
    openAndClick('Console Wallet');
    // Give the WALLET_NOT_INSTALLED effect a tick to route.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(INSTALL_PROMPT)).toBeNull();
    expect(screen.queryByText(/is not available here/i)).toBeNull();
  });
});
