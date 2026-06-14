// @vitest-environment node
/**
 * SSR-safety regression guard.
 *
 * Importing `@partylayer/adapter-console` on the server (Node — no window /
 * IndexedDB) must NOT eagerly load the Console Wallet SDK, which inits localforage
 * and throws "No available storage method found". This is what made next-ssr (and
 * the live demo) log that error.
 *
 * This file DELIBERATELY does not mock '@console-wallet/dapp-sdk' — it exercises
 * the REAL import path. If anyone reintroduces a static value import of the SDK,
 * importing the adapter here will throw and this guard fails.
 */
import { describe, it, expect } from 'vitest';

describe('SSR import safety (no eager SDK/localforage load)', () => {
  it('runs in a server-like env (no window)', () => {
    expect(typeof window).toBe('undefined');
  });

  it('importing the adapter module does not throw', async () => {
    await expect(import('./console-adapter')).resolves.toBeDefined();
  });

  it('constructing the adapter does not load the SDK / init storage', async () => {
    const { ConsoleAdapter } = await import('./console-adapter');
    expect(() => new ConsoleAdapter()).not.toThrow();
  });
});
