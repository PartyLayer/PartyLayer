import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { registryEntryToWalletInfo, type WalletRegistryV1 } from '@partylayer/registry-client';
import { createPartyLayer } from './client';
import { GenericDiscoveryAdapter } from './discovery-adapter';
import { toWalletId } from '@partylayer/core';

vi.mock('@console-wallet/dapp-sdk', () => ({ consoleWallet: {} }));
const mocks = vi.hoisted(() => {
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'getPrimaryAccount') return { partyId: 'party::catalog', networkId: 'canton:da-devnet' };
    if (method === 'status') return { network: { networkId: 'canton:da-devnet' } };
    if (method === 'signMessage') return { signature: 'signed' };
    if (method === 'prepareExecuteAndWait') return { tx: { commandId: 'cmd', payload: { updateId: 'update-1' } } };
    return {};
  });
  const provider = { request, on() { return provider; }, emit() { return false; }, removeListener() { return provider; } };
  const create = vi.fn((host: string, id: string) => ({
    providerId: id, name: id, detect: async () => true,
    provider: () => provider, restore: async () => provider, host,
  }));
  return { request, create };
});
vi.mock('@k2flabs/walley-dapp-sdk', () => ({ WalleyAdapter: class {
  constructor({ host }: { host: string }) { return mocks.create(host, 'walley'); }
} }));
vi.mock('@lithiumdigital/cauri-dapp-sdk', () => ({ cauriAdapterFactory: {
  providerId: 'cauri', create: (host: string) => mocks.create(host, 'cauri'),
} }));
vi.mock('@vala-wallet/dapp-sdk', () => ({ valaAdapterFactory: {
  providerId: 'vala', create: (host: string) => mocks.create(host, 'vala'),
} }));
vi.mock('@oneswap/wallet-cip0103-adapter', () => ({
  createOneSwapProviderAdapter: ({ walletUrl }: { walletUrl: string }) => mocks.create(walletUrl, 'oneswap'),
}));

const clients: ReturnType<typeof createPartyLayer>[] = [];
afterEach(() => { clients.splice(0).forEach(c => c.destroy()); vi.clearAllMocks(); });
const registry = (channel: 'stable' | 'beta') => JSON.parse(readFileSync(
  new URL(`../../../registry/v1/${channel}/registry.json`, import.meta.url), 'utf8',
)) as WalletRegistryV1;

function client(options: Partial<Parameters<typeof createPartyLayer>[0]> = {}) {
  const config = { network: 'devnet' as const, channel: 'beta' as const, app: { name: 'Catalog test', origin: 'https://dapp.example' }, discovery: { announce: false }, ...options };
  const c = createPartyLayer(config);
  const r = registry(config.channel);
  vi.spyOn(c.registryClient, 'getRegistry').mockResolvedValue(r);
  vi.spyOn(c.registryClient, 'getWallets').mockImplementation(async () => r.wallets.map(w => registryEntryToWalletInfo(w, config.channel)));
  vi.spyOn(c.registryClient, 'getWalletEntry').mockImplementation(async id => r.wallets.find(w => w.id === id)!);
  clients.push(c);
  return { c, r };
}

describe('public default wallet catalog', () => {
  it.each(['stable', 'beta'] as const)('checks every %s registry wallet across all three networks', async (channel) => {
    for (const network of ['devnet', 'testnet', 'mainnet'] as const) {
      const { c, r } = client({ channel, network, walletConnect: { projectId: 'catalog-test' }, bron: {
        auth: { authorizationUrl: 'https://auth.example/authorize', tokenUrl: 'https://auth.example/token',
          clientId: 'catalog-test', redirectUri: 'https://dapp.example/callback' },
        api: { baseUrl: 'https://signer.example' },
      } });
      const wallets = await c.listWallets();
      expect(wallets.map(w => String(w.walletId)).sort()).toEqual(
        r.wallets.filter(w => w.supportedNetworks.includes(network)).map(w => w.id).sort(),
      );
      for (const wallet of wallets) {
        expect(wallet.networks).toContain(network);
        expect(wallet.channel).toBe(channel);
        const adapter = c.getAdapter(wallet.walletId);
        if (adapter) expect(wallet.capabilities).toEqual(adapter.getCapabilities());
      }
      expect(wallets.find(w => String(w.walletId) === 'console')?.capabilities).not.toContain('signTransaction');
      for (const capability of ['signMessage', 'signTransaction', 'submitTransaction', 'events', 'transfer'] as const) {
        const filtered = await c.listWallets({ requiredCapabilities: [capability] });
        expect(filtered.map(w => w.walletId).sort()).toEqual(
          wallets.filter(w => w.capabilities.includes(capability)).map(w => w.walletId).sort(),
        );
      }
    }
  });

  it('omits both transports that require developer credentials by default', async () => {
    const { c } = client();
    expect((await c.listWallets()).some(w => ['walletconnect', 'bron'].includes(String(w.walletId)))).toBe(false);
  });

  it('includes every registry official SDK without app imports and warms the popup synchronously', async () => {
    const { c, r } = client();
    const wallets = await c.listWallets();
    for (const entry of r.wallets.filter(w => w.adapter.transport === 'discovery-adapter')) {
      expect(wallets.some(w => String(w.walletId) === entry.id)).toBe(true);
      expect(c.getAdapter(entry.id)).toBeInstanceOf(GenericDiscoveryAdapter);
    }
    mocks.request.mockClear();
    const connecting = c.connect({ walletId: toWalletId('vala') });
    // The connect RPC (which opens the vendor popup) starts in the click stack.
    expect(mocks.request).toHaveBeenCalledWith({ method: 'connect' });
    const session = await connecting;
    expect(session.capabilitiesSnapshot).toEqual(wallets.find(w => String(w.walletId) === 'vala')!.capabilities);
    expect(session.capabilitiesSnapshot).not.toContain('events');
    await c.signMessage({ message: 'hello' });
    expect((await c.submitTransaction({ signedTx: { commands: [] } })).updateId).toBe('update-1');
    await c.disconnect();
    expect(mocks.request).toHaveBeenCalledWith({ method: 'disconnect' });
  });

  it('reloads an official default through its live provider without app registration', async () => {
    const values = new Map<string, string>();
    const storage = {
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, value: string) => { values.set(key, value); },
      remove: async (key: string) => { values.delete(key); },
      clear: async () => { values.clear(); },
    };
    const crypto = { encrypt: async (s: string) => s, decrypt: async (s: string) => s, generateKey: async () => 'test-key' };
    const { c } = client({ storage, crypto });
    await c.connect({ walletId: toWalletId('vala') });
    const { c: reloaded } = client({ storage, crypto });
    await vi.waitFor(async () => expect((await reloaded.getActiveSession())?.partyId).toBe('party::catalog'));
    expect((await reloaded.signMessage({ message: 'after reload' })).signature).toBe('signed');
  });

  it('does not import or synthesize Vala on stable/mainnet, including capability queries', async () => {
    const { c } = client({ network: 'mainnet', channel: 'stable' });
    const wallets = await c.listWallets({ requiredCapabilities: ['signMessage'] });
    expect(wallets.some(w => String(w.walletId) === 'vala')).toBe(false);
    expect(c.getAdapter('vala')).toBeUndefined();
    expect(wallets.every(w => w.channel === 'stable' && w.networks.includes('mainnet'))).toBe(true);
    expect(mocks.create.mock.calls.some(([, id]) => id === 'vala')).toBe(false);
  });

  it('preserves explicit custom adapter replacement and hides unconfigured transports', async () => {
    const { c } = client({ adapters: [] });
    const wallets = await c.listWallets();
    expect(wallets.some(w => ['vala', 'walley', 'cauri', 'oneswap', 'walletconnect', 'bron'].includes(String(w.walletId)))).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('registers configured WalletConnect/Bron through the existing SDK and deduplicates concurrent discovery', async () => {
    const { c } = client({ walletConnect: { projectId: 'my-project' } });
    await Promise.all([c.listWallets(), c.listWallets()]);
    expect(c.getAdapter('walletconnect')).toBeDefined();
    expect(c.getAdapter('bron')).toBeUndefined();
    expect(mocks.create.mock.calls.filter(([, id]) => id === 'vala')).toHaveLength(1);
  });

  it('keeps mainnet-only Send out of Devnet even when directly requested', async () => {
    const { c } = client();
    expect((await c.listWallets()).some(w => String(w.walletId) === 'send')).toBe(false);
    await expect(c.connect({ walletId: toWalletId('send') })).rejects.toThrow();
  });

  it('filters by the bridge capability set instead of offering unsupported signing/events', async () => {
    const { c } = client();
    const wallets = await c.listWallets({ requiredCapabilities: ['signTransaction'] });
    expect(wallets.some(w => String(w.walletId) === 'cauri')).toBe(false);
  });
});
