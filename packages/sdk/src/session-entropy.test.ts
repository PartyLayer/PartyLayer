import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { WalletNotFoundError, toPartyId, toWalletId, type CryptoAdapter, type Session, type StorageAdapter, type WalletAdapter } from '@partylayer/core';
import { createPartyLayer } from './native';
import { DefaultCrypto } from './adapters';

const platform = webcrypto as unknown as Crypto;
const origin = 'https://entropy.example';
const clients: ReturnType<typeof createPartyLayer>[] = [];
beforeEach(() => vi.stubGlobal('crypto', platform));
afterEach(() => { clients.splice(0).forEach(client => client.destroy()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(crypto?: CryptoAdapter, seed?: string) {
  const data = new Map<string, string>(seed ? [['active_session', seed]] : []);
  const storage: StorageAdapter = { get: async key => data.get(key) ?? null,
    set: vi.fn(async (key, value) => { data.set(key, value); }),
    remove: vi.fn(async key => { data.delete(key); }), clear: async () => { data.clear(); } };
  const adapter: WalletAdapter = { walletId: toWalletId('entropy-fixture'), name: 'Entropy fixture',
    detectInstalled: async () => ({ installed: true }), getCapabilities: () => ['connect', 'restore'],
    connect: vi.fn(async () => ({ partyId: toPartyId('party::entropy'), session: { network: 'devnet' }, capabilities: ['connect'] })),
    disconnect: vi.fn(async () => {}), restore: vi.fn(async (_context, saved) => saved as Session) };
  const client = createPartyLayer({ network: 'devnet', app: { name: 'Entropy fixture', origin }, adapters: [adapter], storage, crypto, deferInitialization: true });
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([]);
  vi.spyOn(client.registryClient, 'getWalletEntry').mockRejectedValue(new WalletNotFoundError('fixture'));
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ metadata: { registryVersion: '1', schemaVersion: '1', publishedAt: '2026-11-15T00:00:00Z', sequence: 1, channel: 'stable' }, wallets: [] });
  clients.push(client);
  return { client, adapter, data, storage, prepare: () => client.prepareConnect({ walletId: adapter.walletId }) };
}
const nativeCrypto = (randomBytes?: CryptoAdapter['randomBytes']): CryptoAdapter => ({
  // Explicit test-only metadata transform; no encryption-key material is exposed as a session ID.
  encrypt: async value => value, decrypt: async value => value,
  generateKey: vi.fn(async () => 'hardware-key-handle-must-never-be-session-id'),
  ...(randomBytes ? { randomBytes } : {}),
});

describe('session entropy before wallet effects', () => {
  it('keeps the platform CSPRNG path synchronous through adapter.connect', async () => {
    const crypto = nativeCrypto(); const f = fixture(crypto); const prepared = await f.prepare();
    const connecting = prepared.connect();
    expect(f.adapter.connect).toHaveBeenCalledTimes(1);
    expect((await connecting).sessionId).toMatch(/^session_\d+_[a-f0-9]{64}$/);
    expect(crypto.generateKey).not.toHaveBeenCalled();
  });
  it('fails closed without platform entropy or an explicit hook, before wallet connection', async () => {
    const f = fixture(nativeCrypto()); const prepared = await f.prepare(); vi.stubGlobal('crypto', undefined);
    await expect(prepared.connect()).rejects.toThrow(/secure|entropy|random/i);
    expect(f.adapter.connect).not.toHaveBeenCalled(); expect(f.storage.set).not.toHaveBeenCalled();
  });
  it('uses exact native random bytes, never an encryption key or hardware handle, without adding an await for a sync hook', async () => {
    const randomBytes = vi.fn(() => new Uint8Array(32).fill(0xab)); const crypto = nativeCrypto(randomBytes);
    const f = fixture(crypto); const prepared = await f.prepare(); vi.stubGlobal('crypto', undefined);
    const connecting = prepared.connect(); expect(f.adapter.connect).toHaveBeenCalledTimes(1);
    expect((await connecting).sessionId).toMatch(new RegExp(`^session_\\d+_${'ab'.repeat(32)}$`));
    expect(randomBytes).toHaveBeenCalledWith(32); expect(crypto.generateKey).not.toHaveBeenCalled();
  });
  it.each([undefined, null, [], new Uint8Array(31), new Uint8Array(33), new Uint16Array(32), 'hardware-handle'])('rejects invalid entropy %s before a wallet call', async value => {
    const f = fixture(nativeCrypto(() => value as never)); const prepared = await f.prepare(); vi.stubGlobal('crypto', undefined);
    await expect(prepared.connect()).rejects.toThrow(/bytes|entropy|Uint8Array/i);
    expect(f.adapter.connect).not.toHaveBeenCalled();
  });
  it('does not let an earlier async hook race start a wallet after a newer attempt', async () => {
    const first = deferred<Uint8Array>(), second = deferred<Uint8Array>();
    const randomBytes = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const f = fixture(nativeCrypto(randomBytes)); const prepared = await f.prepare(); vi.stubGlobal('crypto', undefined);
    const one = prepared.connect(); const oneCheck = expect(one).rejects.toThrow(/superseded/);
    const two = prepared.connect(); expect(f.adapter.connect).not.toHaveBeenCalled();
    first.resolve(new Uint8Array(32).fill(1)); await oneCheck; expect(f.adapter.connect).not.toHaveBeenCalled();
    second.resolve(new Uint8Array(32).fill(2)); expect((await two).sessionId).toContain('02'.repeat(32));
    expect(f.adapter.connect).toHaveBeenCalledTimes(1);
  });
  it('destroy while native entropy is pending prevents any subsequent wallet side effect', async () => {
    const entropy = deferred<Uint8Array>(); const f = fixture(nativeCrypto(() => entropy.promise)); const prepared = await f.prepare(); vi.stubGlobal('crypto', undefined);
    const connecting = prepared.connect(); const check = expect(connecting).rejects.toThrow(/superseded/);
    f.client.destroy(); entropy.resolve(new Uint8Array(32)); await check;
    expect(f.adapter.connect).not.toHaveBeenCalled(); expect(f.storage.set).not.toHaveBeenCalled();
  });
  it('rejects malformed async entropy before wallet connection', async () => {
    const f = fixture(nativeCrypto(async () => new Uint8Array(1))); const prepared = await f.prepare(); vi.stubGlobal('crypto', undefined);
    await expect(prepared.connect()).rejects.toThrow(/bytes|entropy|Uint8Array/i); expect(f.adapter.connect).not.toHaveBeenCalled();
  });
});

const saved: Session = { sessionId: 'authenticated-legacy-opaque-id' as Session['sessionId'], walletId: toWalletId('entropy-fixture'), partyId: toPartyId('party::entropy'), network: 'devnet', origin, createdAt: 1, capabilitiesSnapshot: ['connect'] };
describe('invalid default cache handling', () => {
  it('clears legacy base64 plaintext and never hands it to wallet restore', async () => {
    const f = fixture(undefined, btoa(JSON.stringify(saved)));
    expect(await f.client.getActiveSession()).toBeNull(); expect(f.adapter.restore).not.toHaveBeenCalled(); expect(f.data.has('active_session')).toBe(false);
  });
  it('preserves authenticated AES caches with opaque legacy IDs', async () => {
    const encrypted = await new DefaultCrypto().encrypt(JSON.stringify(saved), origin); const f = fixture(undefined, encrypted);
    expect((await f.client.getActiveSession())?.sessionId).toBe(saved.sessionId); expect(f.adapter.restore).toHaveBeenCalledTimes(1);
  });
  it('does not clear a newer session when stale cache decryption rejects after connection', async () => {
    const decrypting = deferred<string>(); const crypto = { ...nativeCrypto(), decrypt: vi.fn(() => decrypting.promise) };
    const f = fixture(crypto, 'old-corrupt-cache'); const restoring = f.client.getActiveSession();
    await vi.waitFor(() => expect(crypto.decrypt).toHaveBeenCalledOnce());
    const connected = await f.client.connect({ walletId: f.adapter.walletId });
    decrypting.reject(new Error('old cache is corrupt')); await restoring;
    expect((await f.client.getActiveSession())?.sessionId).toBe(connected.sessionId); expect(JSON.parse(f.data.get('active_session')!).sessionId).toBe(connected.sessionId);
  });
});
