// @vitest-environment jsdom
/**
 * Native splice-wallet target-channel transport tests.
 *
 * A mock "extension" listens for SPLICE_WALLET_REQUEST on window and replies
 * with SPLICE_WALLET_RESPONSE (the protocol from @canton-network/core-types),
 * so these tests exercise the real postMessage request/response correlation
 * without @canton-network/dapp-sdk (and without the @walletconnect transitive
 * that breaks consumer bundles).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createExtensionChannelProvider } from '../extension-channel';
import { discoverAnnouncedProviders, isCIP0103Provider } from '../discovery';
import { ProviderRpcError } from '../errors';

type Reply = (req: { id: string; method: string; params?: unknown }) =>
  | { result: unknown }
  | { error: { code: number; message: string; data?: unknown } };

/** Stand up a mock extension that answers SPLICE_WALLET_REQUEST messages. */
function mockExtension(reply: Reply): () => void {
  const handler = (event: MessageEvent): void => {
    const data = event.data as { type?: string; request?: { id: string; method: string; params?: unknown } };
    if (data?.type !== 'SPLICE_WALLET_REQUEST' || !data.request) return;
    const out = reply(data.request);
    // Mirror a real content script: post on the page window with
    // source === window and the page origin, so the provider's origin/source
    // guard accepts it.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'SPLICE_WALLET_RESPONSE', response: { jsonrpc: '2.0', id: data.request.id, ...out } },
        source: window,
        origin: window.location.origin,
      }),
    );
  };
  window.addEventListener('message', handler as EventListener);
  return () => window.removeEventListener('message', handler as EventListener);
}

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  delete (window as unknown as { canton?: unknown }).canton;
});

describe('createExtensionChannelProvider', () => {
  it('is a CIP-0103 provider', () => {
    const p = createExtensionChannelProvider({ target: 't' });
    expect(isCIP0103Provider(p)).toBe(true);
  });

  it('round-trips a request → SPLICE_WALLET_RESPONSE result', async () => {
    stop = mockExtension((req) => ({ result: { echoed: req.method, params: req.params } }));
    const p = createExtensionChannelProvider({ target: 'send-target' });
    const result = await p.request<{ echoed: string; params: unknown }>({
      method: 'status',
      params: { a: 1 },
    });
    expect(result.echoed).toBe('status');
    expect(result.params).toEqual({ a: 1 });
  });

  it('rejects with ProviderRpcError carrying the wallet error code', async () => {
    stop = mockExtension(() => ({ error: { code: 4001, message: 'User rejected' } }));
    const p = createExtensionChannelProvider({ target: 't' });
    await expect(p.request({ method: 'connect' })).rejects.toMatchObject({
      code: 4001,
    });
    await expect(p.request({ method: 'connect' })).rejects.toBeInstanceOf(ProviderRpcError);
  });

  it('times out when no extension responds', async () => {
    const p = createExtensionChannelProvider({ target: 't', timeoutMs: 50 });
    await expect(p.request({ method: 'status' })).rejects.toThrow(/timed out/i);
  });

  /**
   * The origin guard, which had no negative test until now.
   *
   * `extension-channel.ts` drops any message whose `event.origin` differs from
   * the page's own. Every case above posts with the correct origin, so the guard
   * was only ever exercised in the direction that passes — the shape of coverage
   * that reports green whether or not the check exists.
   *
   * This belongs here rather than in an e2e: `window.postMessage` always stamps
   * the caller's real origin, so a browser test cannot forge a foreign one. A
   * synthetic MessageEvent can, which is the whole reason the property is
   * testable at this level and not that one. The demo's e2e asserts the adjacent
   * property it CAN reach — that unsolicited traffic creates no session.
   */
  it('drops a well-formed response that arrives from a foreign origin', async () => {
    const handler = (event: MessageEvent): void => {
      const data = event.data as { type?: string; request?: { id: string } };
      if (data?.type !== 'SPLICE_WALLET_REQUEST' || !data.request) return;
      // Correct id, correct shape, correct target — everything except the origin.
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'SPLICE_WALLET_RESPONSE',
            response: { jsonrpc: '2.0', id: data.request.id, result: { spoofed: true } },
          },
          source: window,
          origin: 'https://evil.example',
        }),
      );
    };
    window.addEventListener('message', handler as EventListener);
    stop = () => window.removeEventListener('message', handler as EventListener);

    const p = createExtensionChannelProvider({ target: 't', timeoutMs: 80 });
    // The ONLY thing preventing resolution is the origin check. If it is removed,
    // this request resolves with `{ spoofed: true }` instead of timing out.
    await expect(p.request({ method: 'status' })).rejects.toThrow(/timed out/i);
  });

  it('only resolves its own request ids (concurrent providers do not cross-talk)', async () => {
    stop = mockExtension((req) => ({ result: { id: req.id } }));
    const a = createExtensionChannelProvider({ target: 'a' });
    const b = createExtensionChannelProvider({ target: 'b' });
    const [ra, rb] = await Promise.all([
      a.request<{ id: string }>({ method: 'status' }),
      b.request<{ id: string }>({ method: 'status' }),
    ]);
    expect(ra.id).not.toBe(rb.id); // each got its own correlated response
  });

  it('local event bus on/emit/removeListener works and chains', () => {
    const p = createExtensionChannelProvider({ target: 't' });
    let called = 0;
    const fn = (): void => {
      called += 1;
    };
    expect(p.on('x', fn)).toBe(p);
    expect(p.emit('x')).toBe(true);
    expect(called).toBe(1);
    expect(p.removeListener('x', fn)).toBe(p);
    p.emit('x');
    expect(called).toBe(1);
  });
});

describe('discoverAnnouncedProviders — default native provider (end-to-end)', () => {
  it('builds a working provider (no injected createProvider) that round-trips over the target channel', async () => {
    // Mock extension: announces on request, and answers RPC over postMessage.
    const onRequestProvider = (): void => {
      window.dispatchEvent(
        new CustomEvent('canton:announceProvider', {
          detail: { providerId: 'send-id', name: 'Send', target: 'send-target' },
        }),
      );
    };
    window.addEventListener('canton:requestProvider', onRequestProvider);
    const stopRpc = mockExtension((req) => ({ result: { ok: true, method: req.method } }));
    stop = () => {
      window.removeEventListener('canton:requestProvider', onRequestProvider);
      stopRpc();
    };

    // No createProvider override → uses the native extension-channel provider.
    const found = await discoverAnnouncedProviders({ timeoutMs: 0 });
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('send-id');
    expect(isCIP0103Provider(found[0].provider)).toBe(true);

    const res = await found[0].provider.request<{ ok: boolean; method: string }>({
      method: 'status',
    });
    expect(res).toEqual({ ok: true, method: 'status' });
  });
});
