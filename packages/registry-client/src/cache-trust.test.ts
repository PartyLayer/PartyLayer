import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { RegistryClient } from './client';
import type { CachedRegistry } from './status';
import type { WalletRegistryV1 } from './schema';

const crypto = webcrypto as unknown as Crypto;
const registry = (sequence = 1) => ({ metadata: { registryVersion: '1.0.0', schemaVersion: '1.0.0', publishedAt: '2026-01-01T00:00:00Z', channel: 'stable', sequence }, wallets: [] }) as unknown as WalletRegistryV1;
let pair: CryptoKeyPair; let publicKey: string;
const cacheKey = (url = 'https://registry.test') => `registry_v2_${encodeURIComponent(`${url}/v1/stable/registry.json`)}`;
beforeEach(async () => {
  pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
});
async function signed(sequence = 1): Promise<CachedRegistry> {
  const value = registry(sequence); const registryJson = JSON.stringify(value);
  const signature = Buffer.from(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(registryJson))).toString('base64');
  return { registry: value, registryJson, signature: { algorithm: 'ed25519', signature, keyFingerprint: 'test', signedAt: '2026-01-01T00:00:00Z' }, verified: true, fetchedAt: Date.now(), sequence };
}
const storage = (value: unknown, key = cacheKey()) => ({ get: vi.fn(async (requested: string) => requested === key ? JSON.stringify(value) : null), set: vi.fn(async () => {}), remove: vi.fn(async () => {}) });
const offline = vi.fn(async () => { throw new Error('Offline'); });

it('ignores persisted trust booleans when no exact signed bytes exist', async () => {
  const client = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [publicKey], storage: storage({ registry: registry(), verified: true, fetchedAt: Date.now(), sequence: 1 }), fetch: offline });
  await expect(client.getRegistry()).rejects.toThrow(); expect(client.getStatus()).toBeNull();
});
it('re-verifies exact bytes and discards a tampered parsed object/verified flag', async () => {
  const cached = await signed(); cached.registry = registry(999); cached.verified = false;
  const client = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [publicKey], storage: storage(cached), fetch: offline });
  expect((await client.getRegistry()).metadata.sequence).toBe(1); expect(client.getStatus()?.verified).toBe(true);
});
it('rejects modified signed bytes and a retired signing root after restart', async () => {
  const cached = await signed(); const other = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']) as CryptoKeyPair;
  const replacement = Buffer.from(await crypto.subtle.exportKey('raw', other.publicKey)).toString('base64');
  const retired = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [replacement], storage: storage(cached), fetch: offline });
  await expect(retired.getRegistry()).rejects.toThrow();
  cached.registryJson = JSON.stringify(registry(2)); cached.sequence = 2;
  const altered = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [publicKey], storage: storage(cached), fetch: offline });
  await expect(altered.getRegistry()).rejects.toThrow();
});
it('namespaces caches by source and ignores legacy channel-only entries', async () => {
  const cached = await signed();
  for (const [url, key] of [['https://another.test', cacheKey()], ['https://registry.test', 'registry_stable']]) {
    const saved = storage(cached, key); const client = new RegistryClient({ registryUrl: url, registryPublicKeys: [publicKey], storage: saved, fetch: offline });
    await expect(client.getRegistry()).rejects.toThrow(); expect(saved.get).toHaveBeenCalledWith(cacheKey(url));
  }
});
it('never reports unsigned storage as verified when verification is disabled', async () => {
  const client = new RegistryClient({ registryUrl: 'https://registry.test', storage: storage(await signed()), fetch: offline });
  await client.getRegistry(); expect(client.getStatus()?.verified).toBe(false);
});
it('does not retain a caller-mutable trust root array', async () => {
  const roots = [publicKey]; const client = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: roots, storage: storage(await signed()), fetch: offline });
  roots.length = 0; await client.getRegistry(); expect(client.getStatus()?.verified).toBe(true);
});
it('bounds unavailable storage and prevents a late cache from replacing a fresh network result', async () => {
  let finish!: (value: string) => void; const stale = await signed(1); const fresh = await signed(10);
  const client = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [publicKey], fetchTimeout: 20,
    storage: { ...storage(null), get: () => new Promise(resolve => { finish = resolve; }) },
    fetch: vi.fn(async input => Response.json(String(input).endsWith('.sig') ? fresh.signature : fresh.registry)),
  });
  expect((await client.getRegistry()).metadata.sequence).toBe(10);
  finish(JSON.stringify(stale)); await new Promise(resolve => setTimeout(resolve, 10));
  expect(client.getStatus()?.sequence).toBe(10);
});
it('does not restore an entry after clearCache during cache initialization', async () => {
  let finish!: (value: string) => void; const cached = await signed(1); const fresh = await signed(2);
  const client = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [publicKey], storage: { ...storage(null), get: () => new Promise(resolve => { finish = resolve; }) },
    fetch: vi.fn(async input => Response.json(String(input).endsWith('.sig') ? fresh.signature : fresh.registry)),
  });
  client.clearCache(); finish(JSON.stringify(cached)); expect((await client.getRegistry()).metadata.sequence).toBe(2);
});
it('allows a verified cached startup refresh to finish without waiting on itself', async () => {
  const cached = await signed(); const next = await signed(2);
  const client = new RegistryClient({ registryUrl: 'https://registry.test', registryPublicKeys: [publicKey], storage: storage(cached),
    fetch: vi.fn(async input => Response.json(String(input).endsWith('.sig') ? next.signature : next.registry)),
  });
  expect((await client.getRegistry()).metadata.sequence).toBe(1);
  await vi.waitFor(() => expect(client.getStatus()?.sequence).toBe(2));
});
