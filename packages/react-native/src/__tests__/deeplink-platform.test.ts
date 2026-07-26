/**
 * React Native deep link platform tests (RN Linking mocked).
 *
 * No real device or simulator runs here: CI has no RN runtime, so Linking is a mock.
 * The real runtime check belongs to phase C's Expo demo.
 */
import { describe, it, expect, vi } from 'vitest';
import { DeepLinkTransport } from '@partylayer/core';
import type { RNLinking } from '../types';

// Mock react-native so the module-top `import { Linking } from 'react-native'` resolves
// (react-native itself does not run under Node). This also exercises the REAL import
// path: the no-argument default below comes from this mocked module, so a reversion to a
// bundler-invisible require would fail here rather than only in a browser.
const defaultRemove = vi.fn();
vi.mock('react-native', () => ({
  Linking: {
    openURL: vi.fn(async () => undefined),
    addEventListener: vi.fn(() => ({ remove: defaultRemove })),
    getInitialURL: vi.fn(async () => null),
  },
}));

import { createReactNativeDeepLinkPlatform } from '../deeplink-platform';

function mockLinking(initialUrl: string | null = null): { linking: RNLinking; remove: ReturnType<typeof vi.fn>; handlers: Array<(e: { url: string }) => void> } {
  const handlers: Array<(e: { url: string }) => void> = [];
  const remove = vi.fn();
  const linking: RNLinking = {
    openURL: vi.fn(async () => undefined),
    addEventListener: vi.fn((_type: 'url', handler: (e: { url: string }) => void) => {
      handlers.push(handler);
      return { remove };
    }),
    getInitialURL: vi.fn(async () => initialUrl),
  };
  return { linking, remove, handlers };
}

describe('createReactNativeDeepLinkPlatform', () => {
  it('opens the deep link URL through Linking.openURL', () => {
    const { linking } = mockLinking();
    const platform = createReactNativeDeepLinkPlatform(linking);
    platform.openUrl('mywallet://connect?state=abc');
    expect(linking.openURL).toHaveBeenCalledWith('mywallet://connect?state=abc');
  });

  it('registers a url listener and unsubscribes it', () => {
    const { linking, remove } = mockLinking();
    const platform = createReactNativeDeepLinkPlatform(linking);
    const unsubscribe = platform.subscribe(() => {});
    expect(linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
    expect(remove).not.toHaveBeenCalled();
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('delivers a url event to the callback', () => {
    const { linking, handlers } = mockLinking();
    const platform = createReactNativeDeepLinkPlatform(linking);
    const seen: string[] = [];
    platform.subscribe((cb) => {
      if (cb.url) seen.push(cb.url);
    });
    handlers[0]({ url: 'mywallet://cb?state=abc' });
    expect(seen).toEqual(['mywallet://cb?state=abc']);
  });

  it('consults getInitialURL for a cold start callback', async () => {
    const { linking } = mockLinking('mywallet://cb?state=cold');
    const platform = createReactNativeDeepLinkPlatform(linking);
    const seen: string[] = [];
    platform.subscribe((cb) => {
      if (cb.url) seen.push(cb.url);
    });
    expect(linking.getInitialURL).toHaveBeenCalled();
    // getInitialURL resolves asynchronously; let the promise chain settle.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toContain('mywallet://cb?state=cold');
  });

  it('throws a clear error when Linking is not available', () => {
    expect(() => createReactNativeDeepLinkPlatform({} as unknown as RNLinking)).toThrow(/Linking is not available/);
  });

  it('resolves with NO argument, using the static react-native Linking import', () => {
    // The previously latent path: a consumer calling with no argument, as the JSDoc
    // suggests. It must build a working platform from the default import, not throw.
    const platform = createReactNativeDeepLinkPlatform();
    expect(typeof platform.openUrl).toBe('function');
    expect(typeof platform.subscribe).toBe('function');
    expect(() => platform.openUrl('mywallet://connect')).not.toThrow();
    const unsubscribe = platform.subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
  });

  it('drives a full DeepLinkTransport connect flow with the RN platform', async () => {
    const { linking, handlers } = mockLinking();
    const platform = createReactNativeDeepLinkPlatform(linking);
    const transport = new DeepLinkTransport(platform);
    const promise = transport.openConnectRequest(
      'mywallet://connect',
      { appName: 'T', origin: 'app://x', network: 'devnet', state: 'st-1' },
      { origin: 'app://x', timeoutMs: 1000 },
    );
    expect(linking.openURL).toHaveBeenCalled();
    // Wallet returns via a deep link callback URL.
    setTimeout(() => handlers[0]({ url: 'mywallet://cb?state=st-1&partyId=p::7' }), 20);
    await expect(promise).resolves.toMatchObject({ state: 'st-1', partyId: 'p::7' });
  }, 2000);
});
