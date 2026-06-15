// @vitest-environment jsdom
/**
 * Backward-compat: the deprecated `SendProviderOptions.discover` (legacy one-shot
 * snapshot hook) is still honored — wrapped as find-first — so existing advanced
 * callers don't break when the resolve-on-arrival `waitForProvider` is the default.
 */
import { describe, it, expect, vi } from 'vitest';
import type { DiscoveredProvider } from '@partylayer/provider';
import { SendProvider } from './send-provider';
import { SEND_PRODUCTION_EXTENSION_ID } from './constants';

const mockProvider = () =>
  ({ request: vi.fn(async () => ({})), on: () => {}, emit: () => false, removeListener: () => {} }) as never;

describe('SendProvider — legacy `discover` hook (backward-compat)', () => {
  it('still resolves via the wrapped one-shot discover (no waitForProvider given)', async () => {
    const legacyDiscover = vi.fn(async () => [
      { id: SEND_PRODUCTION_EXTENSION_ID, provider: mockProvider(), source: 'injected', name: 'Send' } as DiscoveredProvider,
    ]);
    const provider = new SendProvider(undefined, { discover: legacyDiscover, announceTimeoutMs: 0 });
    await expect(provider.isInstalled()).resolves.toBe(true);
    expect(legacyDiscover).toHaveBeenCalled();
  });

  it('returns not-installed when legacy discover yields no Send match', async () => {
    const legacyDiscover = vi.fn(async () => [] as DiscoveredProvider[]);
    const provider = new SendProvider(undefined, { discover: legacyDiscover, announceTimeoutMs: 0 });
    await expect(provider.isInstalled()).resolves.toBe(false);
  });
});
