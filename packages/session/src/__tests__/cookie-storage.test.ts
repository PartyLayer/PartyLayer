/**
 * Tests for the cookie-backed SessionStorage (the SSR-friendly backend).
 * Offline + deterministic — a fake in-memory cookie jar stands in for both the
 * browser (document.cookie) and a server (next/headers cookies()) adapter.
 */
import { describe, it, expect } from 'vitest';
import type { CIP0103Account } from '@partylayer/core';
import { createMockWallet } from './local-mock';
import { createSessionStore } from '../store';
import {
  createCookieStorage,
  documentCookieAdapter,
  type CookieAdapter,
} from '../cookie-storage';
import { encodeSessionEnvelope, decodeSessionEnvelope, type PersistedSessionSnapshot } from '../session-envelope';

const COOKIE = 'pl_session';

/** Shared in-memory cookie jar — models a cookie visible to both contexts. */
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
    primary: true, partyId, status: 'allocated', hint: '', publicKey: '', namespace: '', networkId: 'canton:da-devnet',
  };
  return { account: acct, accounts: [acct], networkId: 'canton:da-devnet', connectedAt: 1_700_000_000_000 };
}

describe('createCookieStorage — SessionStorage conformance', () => {
  it('round-trips set → get → remove', () => {
    const storage = createCookieStorage({ adapter: fakeJar().adapter });
    expect(storage.getItem(COOKIE)).toBeNull();
    storage.setItem(COOKIE, 'hello');
    expect(storage.getItem(COOKIE)).toBe('hello');
    storage.removeItem(COOKIE);
    expect(storage.getItem(COOKIE)).toBeNull();
  });

  it('reads/writes SYNCHRONOUSLY (flash-free — not a Promise)', () => {
    const storage = createCookieStorage({ adapter: fakeJar().adapter });
    storage.setItem(COOKIE, 'x');
    const got = storage.getItem(COOKIE);
    expect(got).not.toBeInstanceOf(Promise);
    expect(got).toBe('x');
  });

  it('persists + decodes the SAME versioned session envelope used by encrypted backends', () => {
    const storage = createCookieStorage({ adapter: fakeJar().adapter });
    const snap = snapshot();
    storage.setItem(COOKIE, encodeSessionEnvelope(snap));
    const decoded = decodeSessionEnvelope(storage.getItem(COOKIE)!);
    expect(decoded?.account?.partyId).toBe('party::test-1');
    expect(decoded?.networkId).toBe('canton:da-devnet');
  });
});

describe('createCookieStorage — server read path (SSR)', () => {
  it('a server-side storage reads what a client-side storage wrote (shared cookie)', () => {
    const jar = fakeJar(); // one cookie, two contexts
    const client = createCookieStorage({ adapter: jar.adapter });
    const server = createCookieStorage({ adapter: jar.adapter }); // e.g. wrapping next/headers cookies()
    client.setItem(COOKIE, encodeSessionEnvelope(snapshot('party::ssr-1')));
    // Server (a fresh request) reads the same cookie for SSR hydration:
    const decoded = decodeSessionEnvelope(server.getItem(COOKIE)!);
    expect(decoded?.account?.partyId).toBe('party::ssr-1');
  });
});

describe('documentCookieAdapter — browser default (URL-encode/decode + clear)', () => {
  it('round-trips a value with cookie-hostile characters, and removeItem clears it', () => {
    // Minimal document.cookie mock: a Map with name=value get/set semantics.
    const store = new Map<string, string>();
    const doc = {
      get cookie() {
        return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      },
      set cookie(str: string) {
        const [pair, ...attrs] = str.split('; ');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        const cleared = attrs.some((a) => /^max-age=0$/i.test(a));
        if (cleared) store.delete(name);
        else store.set(name, value);
      },
    };
    (globalThis as { document?: unknown }).document = doc;
    try {
      const storage = createCookieStorage({ adapter: documentCookieAdapter() });
      const tricky = 'a=b; c d&e'; // '=' ';' space '&'
      storage.setItem(COOKIE, tricky);
      expect(storage.getItem(COOKIE)).toBe(tricky); // survived encode→store→decode
      storage.removeItem(COOKIE);
      expect(storage.getItem(COOKIE)).toBeNull();
    } finally {
      delete (globalThis as { document?: unknown }).document;
    }
  });
});

describe('createCookieStorage — size sanity (4KB cookie limit)', () => {
  it('a realistic multi-account envelope is well under 4096 bytes', () => {
    const acct = (id: string): CIP0103Account => ({
      primary: id === 'party::a', partyId: id, status: 'allocated', hint: 'wallet', publicKey: 'ed25519:'.padEnd(60, 'x'), namespace: 'canton', networkId: 'canton:da-devnet',
    });
    const snap: PersistedSessionSnapshot = {
      account: acct('party::a'), accounts: [acct('party::a'), acct('party::b'), acct('party::c')], networkId: 'canton:da-devnet', connectedAt: 1_700_000_000_000, expiresAt: 1_800_000_000_000,
    };
    const encoded = encodeURIComponent(encodeSessionEnvelope(snap));
    expect(encoded.length).toBeLessThan(4096);
  });
});

describe('createCookieStorage — tamper safety', () => {
  it('a corrupt cookie value decodes to null (never throws)', () => {
    const storage = createCookieStorage({ adapter: fakeJar().adapter });
    storage.setItem(COOKIE, '%%%not-json%%%');
    expect(() => decodeSessionEnvelope(storage.getItem(COOKIE)!)).not.toThrow();
    expect(decodeSessionEnvelope(storage.getItem(COOKIE)!)).toBeNull();
  });

  it('a FORGED "connected" cookie cannot forge a connection — restore() re-validates via the provider', async () => {
    // Attacker pre-seeds a plausible connected envelope into the cookie...
    const jar = fakeJar();
    jar.adapter.set(COOKIE, encodeSessionEnvelope(snapshot('party::attacker')));
    // ...but the live provider reports NO active session.
    const store = createSessionStore(createMockWallet({ connected: false }), {
      storage: createCookieStorage({ adapter: jar.adapter }),
    });
    const restored = await store.restore();
    // The forged cookie is NOT trusted: restore ends disconnected.
    expect(restored.status).toBe('disconnected');
    expect(restored.account).toBeNull();
  });
});
