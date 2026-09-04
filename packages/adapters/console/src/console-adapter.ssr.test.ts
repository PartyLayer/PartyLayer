// @vitest-environment node
/**
 * The SSR guard: `detectInstalled()` must report not-installed when there is no
 * `window` at all, rather than throwing during a server render.
 *
 * This file pins `node` with the docblock above because the rest of the package
 * runs under jsdom, where `window` always exists and this branch is unreachable.
 * Expressing it as a per-file environment rather than an `if (isBrowser) return`
 * is the whole point: a conditional inside the test body silently asserts nothing
 * under the wrong environment, which is how the sibling suite came to skip 33
 * tests without anyone noticing.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: vi.fn(),
    isConnected: vi.fn(),
  },
}));

import { ConsoleAdapter } from './console-adapter';

describe('ConsoleAdapter: SSR (no window)', () => {
  it('reports not-installed instead of throwing', async () => {
    expect(typeof window).toBe('undefined'); // the environment is the fixture
    const result = await new ConsoleAdapter({ target: 'local' }).detectInstalled();
    expect(result.installed).toBe(false);
    expect(result.reason).toContain('Browser environment required');
  });
});
