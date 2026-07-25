/**
 * Icon data tests: the format hint is derived correctly for svg, png, jpg, and an
 * unknown extension, and per-wallet info picks the right URL.
 */
import { describe, it, expect } from 'vitest';
import { deriveIconFormat, walletIconInfo } from '../icons';
import type { WalletInfo } from '@partylayer/sdk';

describe('deriveIconFormat', () => {
  it('derives svg, png, and jpg (and jpeg) from the extension', () => {
    expect(deriveIconFormat('https://registry.partylayer.xyz/wallets/console.svg')).toBe('svg');
    expect(deriveIconFormat('https://registry.partylayer.xyz/wallets/walley-logo.png')).toBe('png');
    expect(deriveIconFormat('https://registry.partylayer.xyz/wallets/send-logo.jpg')).toBe('jpg');
    expect(deriveIconFormat('https://x/y.jpeg')).toBe('jpg');
    expect(deriveIconFormat('https://x/y.SVG')).toBe('svg');
  });

  it('ignores a query string or fragment', () => {
    expect(deriveIconFormat('https://x/icon.png?v=2')).toBe('png');
    expect(deriveIconFormat('https://x/icon.svg#frag')).toBe('svg');
  });

  it('returns unknown for an unexpected or missing extension', () => {
    // An unresolvable icon (for example a URL that returns HTML) must not be assumed svg.
    expect(deriveIconFormat('https://registry.partylayer.xyz/wallets/walletconnect.svg.html')).toBe('unknown');
    expect(deriveIconFormat('https://x/icon.webp')).toBe('unknown');
    expect(deriveIconFormat('https://x/noextension')).toBe('unknown');
    expect(deriveIconFormat('')).toBe('unknown');
    expect(deriveIconFormat(undefined)).toBe('unknown');
  });
});

describe('walletIconInfo', () => {
  const base = { name: 'X', website: 'https://x', icons: {} } as unknown as WalletInfo;

  it('prefers md, then sm, then lg', () => {
    expect(
      walletIconInfo({ ...base, walletId: 'a' as never, icons: { sm: 's.png', md: 'm.svg', lg: 'l.jpg' } }).url,
    ).toBe('m.svg');
    expect(walletIconInfo({ ...base, walletId: 'b' as never, icons: { sm: 's.png', lg: 'l.jpg' } }).url).toBe('s.png');
    expect(walletIconInfo({ ...base, walletId: 'c' as never, icons: { lg: 'l.jpg' } }).url).toBe('l.jpg');
  });

  it('derives the format from the chosen URL, and unknown when there is no icon', () => {
    expect(walletIconInfo({ ...base, walletId: 'a' as never, icons: { md: 'm.svg' } })).toEqual({
      walletId: 'a',
      url: 'm.svg',
      format: 'svg',
    });
    expect(walletIconInfo({ ...base, walletId: 'none' as never, icons: {} })).toEqual({
      walletId: 'none',
      url: undefined,
      format: 'unknown',
    });
  });
});
