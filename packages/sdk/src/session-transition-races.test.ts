import { afterEach, expect, it, vi } from 'vitest';
import { toPartyId, toSessionId, toWalletId, type CryptoAdapter, type Session, type Storage, type WalletAdapter } from '@partylayer/core';

vi.mock('@console-wallet/dapp-sdk', () => ({ consoleWallet: {} }));
vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>('@partylayer/registry-client');
  const { WalletNotFoundError } = await vi.importActual<typeof import('@partylayer/core')>('@partylayer/core');
  class Registry {
    async getWallets() { return []; }
    async getWalletEntry(id: string) { throw new WalletNotFoundError(id); }
    async getRegistry() { return { wallets: [], metadata: {} }; }
    getStatus() { return null; }
  }
  return { ...actual, RegistryClient: Registry };
});
import { createPartyLayer } from './index';

const origin = 'https://race.example';
const walletId = toWalletId('transition-fixture');
const saved: Session = { sessionId: toSessionId('saved-session'), walletId, partyId: toPartyId('saved-party'),
  network: 'devnet', origin, createdAt: Date.now(), capabilitiesSnapshot: ['connect', 'disconnect'] };
// Test-only identity transform: fixtures contain public session metadata, no secrets.
const crypto: CryptoAdapter = { encrypt: async value => value, decrypt: async value => value, generateKey: async () => 'fixture' };
const clients: ReturnType<typeof createPartyLayer>[] = [];
afterEach(() => { clients.splice(0).forEach(client => client.destroy()); });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function until(check: () => boolean) { await vi.waitFor(() => expect(check()).toBe(true)); }
function fixture(seed = true) {
  const data = new Map<string, string>(seed ? [['active_session', JSON.stringify(saved)]] : []);
  const storage: Storage = { get: async key => data.get(key) ?? null,
    set: vi.fn(async (key, value) => { data.set(key, value); }),
    remove: vi.fn(async key => { data.delete(key); }), clear: async () => { data.clear(); } };
  const adapter: WalletAdapter = { walletId, name: 'Transition fixture',
    detectInstalled: async () => ({ installed: true }), getCapabilities: () => ['connect', 'disconnect', 'restore'],
    connect: vi.fn(async () => ({ partyId: toPartyId('fresh-party'), session: { network: 'devnet' }, capabilities: ['connect'] })),
    restore: vi.fn(async (_ctx, persisted) => persisted), disconnect: vi.fn(async () => {}) };
  const create = () => {
    const client = createPartyLayer({ network: 'devnet', app: { name: 'Transition tests', origin },
      discovery: { announce: false }, adapters: [adapter], storage, crypto });
    clients.push(client);
    return client;
  };
  return { data, storage, adapter, create };
}

it('coalesces restore reads and prevents a late restore from replacing a fresh connection or its saved identity', async () => {
  const f = fixture();
  const restore = deferred<Session>();
  f.adapter.restore = vi.fn(async () => restore.promise);
  const client = f.create();
  await until(() => vi.mocked(f.adapter.restore!).mock.calls.length === 1);
  const first = client.getActiveSession();
  const second = client.getActiveSession();
  const connected: string[] = [];
  client.on('session:connected', event => { if (event.type === 'session:connected') connected.push(String(event.session.partyId)); });
  await client.connect({ walletId });
  restore.resolve(saved);
  expect((await first)?.partyId).toBe('fresh-party');
  expect((await second)?.partyId).toBe('fresh-party');
  expect(vi.mocked(f.adapter.restore!).mock.calls).toHaveLength(1);
  expect(JSON.parse(f.data.get('active_session')!).partyId).toBe('fresh-party');
  expect(connected).toEqual(['fresh-party']);
});

it('disconnect during restore clears the saved session and cannot later reconnect itself', async () => {
  const f = fixture();
  const restore = deferred<Session>();
  f.adapter.restore = vi.fn(async () => restore.promise);
  const client = f.create();
  await until(() => vi.mocked(f.adapter.restore!).mock.calls.length === 1);
  const pending = client.getActiveSession();
  await client.disconnect();
  restore.resolve(saved);
  expect(await pending).toBeNull();
  expect(await client.getActiveSession()).toBeNull();
  expect(f.data.has('active_session')).toBe(false);
});

it('destroy cannot be undone by a late restore and does not rewrite the saved session', async () => {
  const f = fixture();
  const restore = deferred<Session>();
  f.adapter.restore = vi.fn(async () => restore.promise);
  const client = f.create();
  await until(() => vi.mocked(f.adapter.restore!).mock.calls.length === 1);
  const pending = client.getActiveSession();
  client.destroy();
  restore.resolve(saved);
  expect(await pending).toBeNull();
  expect(await client.getActiveSession()).toBeNull();
  expect(f.storage.set).not.toHaveBeenCalled();
});

it('keeps the newest user connection when an earlier wallet approval returns last', async () => {
  const f = fixture(false);
  const one = deferred<Awaited<ReturnType<WalletAdapter['connect']>>>();
  const two = deferred<Awaited<ReturnType<WalletAdapter['connect']>>>();
  f.adapter.connect = vi.fn().mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise);
  const client = f.create();
  const first = client.connect({ walletId }).catch(error => error);
  await until(() => vi.mocked(f.adapter.connect).mock.calls.length === 1);
  const second = client.connect({ walletId });
  await until(() => vi.mocked(f.adapter.connect).mock.calls.length === 2);
  const result = (party: string) => ({ partyId: toPartyId(party), session: { network: 'devnet' as const }, capabilities: [] });
  two.resolve(result('second'));
  expect((await second).partyId).toBe('second');
  one.resolve(result('first'));
  expect((await first).message).toContain('superseded');
  expect((await client.getActiveSession())?.partyId).toBe('second');
  expect(JSON.parse(f.data.get('active_session')!).partyId).toBe('second');
});

it('serializes slow storage writes so an old save cannot overwrite the newer connection', async () => {
  const f = fixture(false);
  const release = deferred<void>();
  let writes = 0;
  f.storage.set = vi.fn(async (key, value) => { if (++writes === 1) await release.promise; f.data.set(key, value); });
  f.adapter.connect = vi.fn().mockResolvedValueOnce({ partyId: toPartyId('first'), session: { network: 'devnet' }, capabilities: [] })
    .mockResolvedValueOnce({ partyId: toPartyId('second'), session: { network: 'devnet' }, capabilities: [] });
  const client = f.create();
  const first = client.connect({ walletId }).catch(error => error);
  await until(() => writes === 1);
  const second = client.connect({ walletId });
  await until(() => vi.mocked(f.adapter.connect).mock.calls.length === 2);
  release.resolve();
  await first;
  await second;
  expect(JSON.parse(f.data.get('active_session')!).partyId).toBe('second');
});

it('does not clear a fresh connection when an earlier disconnect returns late', async () => {
  const f = fixture();
  const client = f.create();
  expect((await client.getActiveSession())?.partyId).toBe(saved.partyId);
  const release = deferred<void>();
  f.adapter.disconnect = vi.fn(async () => release.promise);
  const disconnect = client.disconnect();
  await until(() => vi.mocked(f.adapter.disconnect).mock.calls.length === 1);
  await client.connect({ walletId });
  release.resolve();
  await disconnect;
  expect((await client.getActiveSession())?.partyId).toBe('fresh-party');
  expect(JSON.parse(f.data.get('active_session')!).partyId).toBe('fresh-party');
});
