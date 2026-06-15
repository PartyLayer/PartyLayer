// @vitest-environment jsdom
/**
 * Split detect/connect announce bounds — the EIP-6963 reactive-readiness model:
 *   - DETECT (isInstalled / detectInstalled): ~1000ms, best-effort readiness —
 *     must not stall the UI for seconds when Send is absent.
 *   - CONNECT (request path): 3000ms, a deliberate action that tolerates a
 *     late-injecting extension.
 *
 * Proven deterministically (no real multi-second timers) by injecting a
 * `waitForProvider` that (1) records the bound each path passes, and (2) models
 * an announce arriving at a fixed time, resolving the match iff the caller's
 * bound reaches it. The >1s-late case is the reported bug's tail: detect reports
 * not-yet, but connect (3s) still succeeds — and the SDK client's persistent
 * accumulator (see announce-accumulator.test.ts) surfaces it in listWallets().
 */
import { describe, it, expect } from 'vitest';
import type { DiscoveredProvider, WaitForAnnouncedOptions } from '@partylayer/provider';
import { SendProvider } from './send-provider';
import { SEND_PRODUCTION_EXTENSION_ID } from './constants';

const sendEntry = (): DiscoveredProvider => ({
  id: SEND_PRODUCTION_EXTENSION_ID,
  provider: {
    request: async () => ({ isConnected: true }),
    on: () => {},
    emit: () => false,
    removeListener: () => {},
  } as never,
  source: 'injected',
  name: 'Send',
});

/**
 * Models Send announcing at `arrivalMs`: resolves the match iff the caller's
 * bound (timeoutMs) reaches that arrival, else null. Synchronous (no real
 * timer) — the bound comparison is what the split tests assert.
 */
function announceAt(arrivalMs: number) {
  return (
    predicate: (p: DiscoveredProvider) => boolean,
    options?: WaitForAnnouncedOptions,
  ): Promise<DiscoveredProvider | null> => {
    const bound = options?.timeoutMs ?? 3000;
    const entry = sendEntry();
    return Promise.resolve(arrivalMs <= bound && predicate(entry) ? entry : null);
  };
}

describe('SendProvider — split detect/connect announce bounds', () => {
  it('detect path uses the 1000ms bound, connect/request path the 3000ms bound', async () => {
    const bounds: number[] = [];
    const recordBound = (
      _pred: (p: DiscoveredProvider) => boolean,
      options?: WaitForAnnouncedOptions,
    ): Promise<DiscoveredProvider | null> => {
      bounds.push(options?.timeoutMs ?? -1);
      return Promise.resolve(null);
    };
    const provider = new SendProvider(undefined, { waitForProvider: recordBound });

    await provider.isInstalled(); // DETECT
    expect(bounds.at(-1)).toBe(1000);

    await provider.status().catch(() => {}); // CONNECT/request (null channel → throws)
    expect(bounds.at(-1)).toBe(3000);
  });

  it('a sub-1s late announce is captured by the detect path', async () => {
    const provider = new SendProvider(undefined, { waitForProvider: announceAt(700) });
    await expect(provider.isInstalled()).resolves.toBe(true); // 700 < 1000 detect bound
  });

  it('a >1s-late announce: detect reports not-yet, but connect (3s) still succeeds', async () => {
    const provider = new SendProvider(undefined, { waitForProvider: announceAt(1500) });
    await expect(provider.isInstalled()).resolves.toBe(false); // 1500 > 1000 detect bound
    const status = await provider.status(); // 1500 < 3000 connect bound
    expect(status.isConnected).toBe(true);
  });

  it('an announce past BOTH bounds: detect and connect both report absent', async () => {
    const provider = new SendProvider(undefined, { waitForProvider: announceAt(4000) });
    await expect(provider.isInstalled()).resolves.toBe(false);
    await expect(provider.status()).rejects.toThrow(); // SendNotInstalledError
  });
});
