// @vitest-environment jsdom
/**
 * Wallet-icon fallback lock-down.
 *
 * When an icon asset genuinely fails to load -- a network error, a 404, or an
 * HTTP 200 whose body is not an image -- ModalWalletIcon must fall back to the
 * neutral, letter-free glyph: never a blank tile, and never a name initial (the
 * standing no-letter rule). jsdom does not fetch or decode images, so we fire the
 * img's `error` event to exercise the exact onError path a browser takes on a
 * broken asset. (The browser-side trigger itself -- that a real 404 or an HTTP
 * 200 text/html response fires `error` -- was separately verified against the
 * live CDN in headless Chromium.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { toWalletId } from '@partylayer/core';
// vitest hoists the vi.mock calls below above every import, so the modal sees the
// mocks even though it is imported here at the top.
import { WalletModal } from './modal';

const WALLET = {
  walletId: toWalletId('console'),
  name: 'Console Wallet',
  capabilities: ['connect', 'disconnect', 'signMessage', 'injected'],
  icons: {},
  website: '',
  adapter: { packageName: 'builtin', versionRange: '*' },
  docs: [],
  networks: ['devnet'],
  metadata: { transport: 'extension' },
};

vi.mock('./hooks', () => ({
  useWallets: () => ({ wallets: [WALLET], isLoading: false }),
  useConnect: () => ({ connect: async () => null, error: null, reset: () => {} }),
  useRegistryStatus: () => ({ status: { verified: true }, refresh: vi.fn() }),
}));
vi.mock('./theme', () => ({
  useTheme: () => ({
    mode: 'light',
    fontFamily: 'sans-serif',
    colors: {
      background: '#fff', surface: '#F5F6F8', border: 'rgba(15,23,42,0.10)', overlay: 'rgba(0,0,0,0.5)',
      text: '#000', textSecondary: '#64748B', primary: '#fc0', primaryHover: '#e6b800',
      success: '#0a0', error: '#f00', warning: '#fa0',
    },
  }),
}));
vi.mock('./kit', () => ({
  useWalletIcons: () => ({}),
  // A genuinely broken asset: this is what a 404 / non-image URL resolves to.
  resolveWalletIcon: () => 'https://registry.partylayer.xyz/wallets/does-not-exist.svg',
  useWalletOrder: () => null,
  useAttribution: () => null,
}));
vi.mock('@partylayer/sdk', () => ({ isCip0103Native: () => false }));
vi.mock('qrcode', () => ({ toString: vi.fn(async () => '<svg></svg>') }));

afterEach(cleanup);

describe('wallet-icon fallback: a broken asset falls back to the neutral, letter-free glyph', () => {
  it('renders the <img> first, then the letter-free glyph once it errors', () => {
    render(createElement(WalletModal, { isOpen: true, onClose: () => {}, onConnect: () => {} }));

    // The row renders the <img> for the resolved (broken) URL.
    const img = screen.getByAltText('Console Wallet');
    expect(img.tagName).toBe('IMG');
    const slot = img.parentElement as HTMLElement;

    // Simulate the browser firing onError for the broken asset.
    fireEvent.error(img);

    // The <img> is gone (it fell back)...
    expect(slot.querySelector('img')).toBeNull();
    // ...replaced in place by the fallback glyph: a DIV with the same accessible
    // name, and crucially NO text -- no name initial, no letter of any kind.
    const glyph = slot.querySelector('div[aria-label="Console Wallet"]') as HTMLElement;
    expect(glyph).not.toBeNull();
    expect(glyph.textContent).toBe('');
  });
});
