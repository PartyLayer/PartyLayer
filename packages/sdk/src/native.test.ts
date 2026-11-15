import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPartyLayer, type PartyLayerConfig } from './native';
import { toPartyId, toWalletId, type WalletAdapter, type CIP0103Provider, type OfficialProviderAdapter, WalletNotFoundError } from '@partylayer/core';
import { registryEntryToWalletInfo } from '@partylayer/registry-client';
import { readFileSync } from 'node:fs';

const clients: ReturnType<typeof createPartyLayer>[] = [];
afterEach(() => { clients.splice(0).forEach(client => client.destroy()); vi.unstubAllGlobals(); });
function client(adapters: PartyLayerConfig['adapters'] = []) {
  const c = createPartyLayer({ network: 'devnet', app: { name: 'Native test', origin: 'myapp://' }, adapters, deferInitialization: true });
  clients.push(c);
  const registry = JSON.parse(readFileSync(new URL('../../../registry/v1/stable/registry.json', import.meta.url), 'utf8'));
  vi.spyOn(c.registryClient, 'getRegistry').mockResolvedValue(registry);
  vi.spyOn(c.registryClient, 'getWallets').mockResolvedValue(registry.wallets.map((entry: Parameters<typeof registryEntryToWalletInfo>[0]) => registryEntryToWalletInfo(entry, 'stable')));
  vi.spyOn(c.registryClient, 'getWalletEntry').mockImplementation(async id => {
    const entry = registry.wallets.find((entry: { id: string }) => entry.id === id);
    if (!entry) throw new WalletNotFoundError(id);
    return entry;
  });
  return c;
}

describe('native SDK entry', () => {
  it('does not advertise browser wallets or capabilities without a supplied transport', async () => {
    const c = client();
    expect(await c.listWallets()).toEqual([]);
    await expect(c.connect()).rejects.toThrow(/No native wallet transports are configured/);
  });

  it('preserves connect/sign/disconnect through an application-supplied native adapter', async () => {
    const disconnect = vi.fn(async () => {});
    const signMessage = vi.fn(async () => ({ signature: 'native-fixture-signature' }));
    const adapter: WalletAdapter = {
      walletId: toWalletId('native-fixture'), name: 'Application native transport',
      getCapabilities: () => ['connect', 'disconnect', 'signMessage'],
      detectInstalled: async () => ({ installed: true }),
      connect: async () => ({ partyId: toPartyId('party::native-fixture'), session: { network: 'devnet' }, capabilities: ['connect', 'disconnect', 'signMessage'] }),
      disconnect, signMessage,
    };
    const c = client([adapter]);
    const session = await c.connect({ walletId: adapter.walletId });
    expect(session.partyId).toBe('party::native-fixture');
    expect(await c.signMessage({ message: 'native fixture' })).toMatchObject({ signature: 'native-fixture-signature', message: 'native fixture', partyId: 'party::native-fixture' });
    expect(signMessage).toHaveBeenCalledOnce();
    await c.disconnect();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('preserves an application-supplied official provider without browser discovery ownership', async () => {
    vi.stubGlobal('window', {});
    const replies: Record<string, unknown> = {
      connect: { isConnected: true },
      getPrimaryAccount: { partyId: 'party::native-provider', networkId: 'canton:da-devnet' },
      status: { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } },
    };
    const provider: CIP0103Provider = {
      request: vi.fn(async ({ method }: { method: string }) => replies[method]) as CIP0103Provider['request'],
      on: () => provider, emit: () => false, removeListener: () => provider,
    };
    const official: OfficialProviderAdapter = {
      providerId: 'native-provider-fixture', name: 'Application native provider',
      detect: async () => true, provider: () => provider,
    };
    const c = client([official]);
    expect((await c.connect({ walletId: toWalletId('native-provider-fixture') })).partyId).toBe('party::native-provider');
    await c.disconnect();
    expect(vi.mocked(provider.request).mock.calls.map(([args]) => args.method)).toContain('disconnect');
  });

  it('supports the React Native window alias without accessing browser location', () => {
    vi.stubGlobal('window', {});
    const c = createPartyLayer({ network: 'devnet', app: { name: 'Window alias' }, deferInitialization: true });
    clients.push(c);
    expect(c).toBeDefined();
  });

  it.each(['walletConnect', 'bron'])('rejects browser-only automatic %s setup with actionable guidance', key => {
    expect(() => createPartyLayer({ network: 'devnet', app: { name: 'Native test' }, [key]: {} } as PartyLayerConfig)).toThrow(/native-compatible WalletAdapter or provider through adapters/);
  });
});
