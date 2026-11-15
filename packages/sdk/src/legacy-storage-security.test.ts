// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { Session } from '@partylayer/core';
import { LocalSessionStorage } from './storage';

const origin = 'https://storage.example';
const session = { sessionId: 'opaque-legacy-session', walletId: 'test', partyId: 'party::test', network: 'devnet', origin, createdAt: 1, capabilitiesSnapshot: [] } as Session;
const key = `partylayer_session_${session.sessionId}`;
beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('legacy storage never writes encoded plaintext when crypto is unavailable', async () => {
  vi.stubGlobal('crypto', undefined);
  await new LocalSessionStorage(origin).set(session);
  expect(localStorage.getItem(key)).toBeNull();
});
it('legacy storage rejects and removes weak plaintext-base64 cache entries', async () => {
  vi.stubGlobal('crypto', webcrypto);
  localStorage.setItem(key, btoa(JSON.stringify(session)));
  expect(await new LocalSessionStorage(origin).get(String(session.sessionId))).toBeNull();
  expect(localStorage.getItem(key)).toBeNull();
});
it('legacy storage retains its authenticated AES roundtrip', async () => {
  vi.stubGlobal('crypto', webcrypto);
  const storage = new LocalSessionStorage(origin); await storage.set(session);
  expect(localStorage.getItem(key)).not.toBe(btoa(JSON.stringify(session)));
  expect(await storage.get(String(session.sessionId))).toEqual(session);
});
