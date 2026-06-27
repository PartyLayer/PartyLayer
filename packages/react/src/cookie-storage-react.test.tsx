// @vitest-environment jsdom
/**
 * React-side cookie storage integration. Offline + deterministic: a fake in-memory
 * cookie jar stands in for both the browser (document.cookie) and a server
 * (next/headers cookies()) adapter, exactly as the session package test does. The
 * React surface re-exports the session building blocks, so these assert the React
 * package exposes a working cookie storage option and the cross-boundary read.
 */
import { describe, it, expect } from 'vitest';
import type { CIP0103Account } from '@partylayer/core';
import {
  encodeSessionEnvelope,
  decodeSessionEnvelope,
  type CookieAdapter,
  type PersistedSessionSnapshot,
} from '@partylayer/session';

// Import from the React package's main index to prove the surface resolves there.
import {
  createCookieStorage,
  documentCookieAdapter,
  createLocalStorage,
} from './index';

const COOKIE = 'pl_session';
const KEY = 'partylayer.session.connected';

/** Shared in-memory cookie jar: models one cookie visible to both contexts. */
function fakeJar(): { adapter: CookieAdapter; raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    adapter: {
      get: (name) => (raw.has(name) ? raw.get(name)! : null),
      set: (name, value) => void raw.set(name, value),
      remove: (name) => void raw.delete(name),
    },
  };
}

function snapshot(partyId = 'party::test-1'): PersistedSessionSnapshot {
  const acct: CIP0103Account = {
    primary: true,
    partyId,
    status: 'allocated',
    hint: '',
    publicKey: '',
    namespace: '',
    networkId: 'canton:da-devnet',
    signingProviderId: '',
  };
  return { account: acct, accounts: [acct], networkId: 'canton:da-devnet', connectedAt: 1_700_000_000_000 };
}

describe('createCookieStorage (React surface)', () => {
  it('is re-exported from @partylayer/react alongside documentCookieAdapter and createLocalStorage', () => {
    expect(typeof createCookieStorage).toBe('function');
    expect(typeof documentCookieAdapter).toBe('function');
    expect(typeof createLocalStorage).toBe('function');
  });

  it('round-trips set -> get -> remove via an injected adapter', () => {
    const storage = createCookieStorage({ adapter: fakeJar().adapter });
    expect(storage.getItem(KEY)).toBeNull();
    storage.setItem(KEY, 'hello');
    expect(storage.getItem(KEY)).toBe('hello');
    storage.removeItem(KEY);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('reads synchronously (flash-free, not a Promise)', () => {
    const storage = createCookieStorage({ adapter: fakeJar().adapter });
    storage.setItem(KEY, 'x');
    const got = storage.getItem(KEY);
    expect(got).not.toBeInstanceOf(Promise);
    expect(got).toBe('x');
  });
});

describe('SSR cross-boundary hydration (client writes, server reads the same cookie)', () => {
  it('a server-side storage reads + decodes what a client-side storage wrote', () => {
    const jar = fakeJar(); // one cookie, two contexts

    // CLIENT: persists the session envelope to the cookie.
    const client = createCookieStorage({ adapter: jar.adapter });
    client.setItem(KEY, encodeSessionEnvelope(snapshot('party::ssr-1')));

    // SERVER (a fresh request): a separate storage over the SAME jar reads it back.
    // Cookie getItem is synchronous; the SessionStorage type is MaybePromise.
    const server = createCookieStorage({ adapter: jar.adapter });
    const decoded = decodeSessionEnvelope((server.getItem(KEY) as string | null) ?? '');

    expect(decoded?.account?.partyId).toBe('party::ssr-1');
    expect(decoded?.networkId).toBe('canton:da-devnet');
  });

  it('a server read-only adapter (set/remove no-ops) still reads the persisted value', () => {
    const jar = fakeJar();
    createCookieStorage({ adapter: jar.adapter }).setItem(KEY, encodeSessionEnvelope(snapshot('party::ro-1')));

    // Mirror a Server Component adapter wrapping next/headers cookies(): read-only.
    const readOnly: CookieAdapter = {
      get: (name) => jar.adapter.get(name),
      set: () => {},
      remove: () => {},
    };
    const server = createCookieStorage({ adapter: readOnly });
    const decoded = decodeSessionEnvelope((server.getItem(KEY) as string | null) ?? '');
    expect(decoded?.account?.partyId).toBe('party::ro-1');
  });
});

describe('createLocalStorage is unaffected (existing behavior identical)', () => {
  it('still round-trips via window.localStorage (jsdom)', () => {
    const storage = createLocalStorage();
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    expect(window.localStorage.getItem('k')).toBe('v'); // really localStorage, not the cookie jar
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('is a different backend from cookie storage (no cross-talk)', () => {
    const jar = fakeJar();
    const cookie = createCookieStorage({ adapter: jar.adapter });
    const local = createLocalStorage();
    cookie.setItem(KEY, 'in-cookie');
    expect(local.getItem(KEY)).toBeNull(); // localStorage did not see the cookie write
    expect(jar.raw.get(COOKIE)).toBe('in-cookie');
  });
});
