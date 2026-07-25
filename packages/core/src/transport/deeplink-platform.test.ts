/**
 * Tests for the injectable deep link platform: the browser default still behaves as
 * before (opens via the browser primitives), and a custom injected platform is used
 * instead of the browser one.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DeepLinkTransport, type DeepLinkPlatform, type DeepLinkCallback } from './deeplink';
import type { ConnectRequest, TransportOptions } from './types';

const request: ConnectRequest = {
  appName: 'Test',
  origin: 'https://test.com',
  network: 'devnet',
  state: 'state-abc',
};
const options: TransportOptions = { origin: 'https://test.com', timeoutMs: 1000 };

describe('browser default platform (no regression)', () => {
  const originalWindow = global.window;
  afterEach(() => {
    global.window = originalWindow;
  });

  it('opens the deep link through the browser primitives when no platform is injected', async () => {
    const openSpy = vi.fn(() => ({ closed: false }) as unknown as Window);
    const listeners: Array<(e: MessageEvent) => void> = [];
    global.window = {
      location: { href: '', hash: '' },
      open: openSpy,
      addEventListener: vi.fn((type: string, h: (e: MessageEvent) => void) => {
        if (type === 'message' || type === 'hashchange') listeners.push(h);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as typeof window;

    const transport = new DeepLinkTransport(); // default = browser
    const promise = transport.openConnectRequest('mywallet://connect', { ...request }, options);

    // The browser open primitive set location.href and called window.open.
    expect(global.window.location.href).toContain('mywallet://connect');
    expect(openSpy).toHaveBeenCalled();

    // Deliver a matching postMessage callback.
    setTimeout(() => {
      listeners.forEach((h) =>
        h(new MessageEvent('message', { origin: 'https://test.com', data: { state: 'state-abc', partyId: 'p::1' } })),
      );
    }, 20);
    await expect(promise).resolves.toMatchObject({ state: 'state-abc' });
  }, 2000);
});

describe('injected custom platform', () => {
  it('uses the injected platform and never touches the DOM', async () => {
    let deliver: ((cb: DeepLinkCallback) => void) | undefined;
    const openUrl = vi.fn();
    const unsubscribe = vi.fn();
    const platform: DeepLinkPlatform = {
      openUrl,
      subscribe: (onCallback) => {
        deliver = onCallback;
        return unsubscribe;
      },
    };

    const transport = new DeepLinkTransport(platform);
    const promise = transport.openConnectRequest('mywallet://connect', { ...request }, options);

    // The injected open primitive received the built deep link URL.
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl.mock.calls[0][0]).toContain('mywallet://connect');
    expect(openUrl.mock.calls[0][0]).toContain('state=state-abc');

    // Deliver a native URL callback through the injected platform.
    setTimeout(() => deliver?.({ url: 'mywallet://cb?state=state-abc&partyId=p::9' }), 20);
    await expect(promise).resolves.toMatchObject({ state: 'state-abc', partyId: 'p::9' });

    // The transport unsubscribed on completion.
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  }, 2000);

  it('ignores a URL callback whose state does not match', async () => {
    let deliver: ((cb: DeepLinkCallback) => void) | undefined;
    const platform: DeepLinkPlatform = {
      openUrl: vi.fn(),
      subscribe: (onCallback) => {
        deliver = onCallback;
        return () => {};
      },
    };
    const transport = new DeepLinkTransport(platform);
    const promise = transport.openConnectRequest('mywallet://connect', { ...request }, { ...options, timeoutMs: 200 });
    setTimeout(() => deliver?.({ url: 'mywallet://cb?state=wrong' }), 20);
    await expect(promise).rejects.toThrow('Transport timeout');
  }, 1000);
});
