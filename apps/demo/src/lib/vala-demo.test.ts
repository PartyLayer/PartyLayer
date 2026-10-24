import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPartyLayer, GenericDiscoveryAdapter } from '@partylayer/sdk';
import { registryEntryToWalletInfo, type RegistryWalletEntry } from '@partylayer/registry-client';
import { toWalletId } from '@partylayer/core';
import { getRegistrySnapshot, getAllWalletIds, getIndexableWalletIds } from './wallet-directory';

const registry = JSON.parse(readFileSync(new URL('../../../../registry/v1/beta/registry.json', import.meta.url), 'utf8'));
const vala = registry.wallets.find((w: RegistryWalletEntry) => w.id === 'vala') as RegistryWalletEntry;
assert.ok(vala);

test('the generated directory includes the beta Vala page without stable promotion', () => {
  const snapshot = getRegistrySnapshot();
  assert.equal(snapshot.wallets.filter(w => w.id === 'vala').length, 1);
  const wallet = snapshot.wallets.find(w => w.id === 'vala')!;
  assert.equal(wallet.channel, 'beta');
  assert.equal(wallet.beta, true);
  assert.deepEqual(wallet.networks, ['devnet']);
  assert.ok(wallet.note?.construct.includes('valaAdapterFactory'));
  assert.ok(getAllWalletIds().includes('vala'));
  assert.ok(!getIndexableWalletIds().includes('vala'));
  assert.equal(new Set(snapshot.wallets.map(w => w.id)).size, snapshot.wallets.length);
});

test('the public default Vala factory lists the beta wallet and resolves only its Devnet host', async () => {
  const client = createPartyLayer({
    network: 'devnet', channel: 'beta',
    app: { name: 'Vala beta test', origin: 'https://test.example' }, discovery: { announce: false },
  });
  client.registryClient.getWallets = async () => [registryEntryToWalletInfo(vala, 'beta')];
  client.registryClient.getRegistry = async () => registry;
  client.registryClient.getWalletEntry = async () => vala;
  try {
    const wallets = await client.listWallets();
    const wallet = wallets.find(w => String(w.walletId) === 'vala');
    assert.ok(wallet);
    assert.equal(wallet.metadata?.beta, 'true');
    assert.ok(!wallet.capabilities.includes('events'));
    const adapter = client.getAdapter('vala') as GenericDiscoveryAdapter;
    assert.ok(adapter instanceof GenericDiscoveryAdapter);
    adapter.setNetworkHosts(vala.adapter.networkHosts!);
    adapter.resolveOfficial('devnet');
  } finally { client.destroy(); }
});

test('beta connect routes the registry host through the existing CIP-0103 bridge', async () => {
  const hosts: string[] = [];
  const methods: string[] = [];
  const provider = {
    async request({ method }: { method: string }) {
      methods.push(method);
      if (method === 'connect') return { isConnected: true };
      if (method === 'getPrimaryAccount') return { partyId: 'test::vala', networkId: 'canton:da-devnet' };
      if (method === 'status') return { network: { networkId: 'canton:da-devnet' } };
      return null;
    },
    on() { return provider; }, emit() { return false; }, removeListener() { return provider; },
  };
  const client = createPartyLayer({
    network: 'devnet', channel: 'beta', app: { name: 'Vala routing test', origin: 'https://test.example' },
    discovery: { announce: false },
    adapters: [{ providerId: 'vala', create(host) {
      hosts.push(host);
      return { providerId: 'vala', name: 'Vala', type: 'remote', getInfo: () => ({ providerId: 'vala', name: 'Vala', type: 'remote' }), detect: async () => true, provider: () => provider };
    } }],
  });
  client.registryClient.getWallets = async () => [registryEntryToWalletInfo(vala, 'beta')];
  client.registryClient.getRegistry = async () => registry;
  client.registryClient.getWalletEntry = async () => vala;
  try {
    const session = await client.connect({ walletId: toWalletId('vala') });
    assert.equal(String(session.partyId), 'test::vala');
    assert.deepEqual(hosts, [vala.adapter.networkHosts!.devnet]);
    assert.ok(methods.includes('connect') && methods.includes('getPrimaryAccount'));
  } finally { client.destroy(); }
});
