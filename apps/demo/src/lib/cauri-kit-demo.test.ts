/**
 * Cauri is registered as an OfficialAdapterFactory (providerId + create) inside
 * buildDemoAdapters(), so every demo surface carries it. Since the entry was
 * promoted to the stable registry the kit demo no longer overrides the channel:
 * it passes buildDemoAdapters() to PartyLayerKit and reads the default stable
 * channel, which is createPartyLayer({ adapters, channel }) underneath. This
 * exercises that same client wiring with a MOCK adapter and no network:
 *
 *  - APPEARS: with the factory registered, listWallets on stable surfaces cauri
 *    with its registry name and icon.
 *  - ABSENT: without it, the discovery-adapter entry is gated out, so a consumer
 *    who never wired cauri is not shown a dead tile. This is what keeps cauri
 *    correctly hidden in apps/tokenization and apps/dvp, which do not register it.
 *  - CONNECT REACHES THE ADAPTER: connecting builds the official through the
 *    factory with the host resolved from the registry entry's networkHosts and
 *    drives its provider, with no wallet URL in app code and no network.
 *
 * The real cauri entry is read from the shipped stable registry so host
 * resolution is proven against what actually ships, not an inlined copy. Each
 * test calls client.destroy() so the SDK's telemetry flush timer does not keep
 * the process alive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPartyLayer } from '@partylayer/sdk';
import { registryEntryToWalletInfo } from '@partylayer/registry-client';
import { toWalletId } from '@partylayer/core';

const stablePath = fileURLToPath(new URL('../../../../registry/v1/stable/registry.json', import.meta.url));
const CAURI = JSON.parse(readFileSync(stablePath, 'utf8')).wallets.find((w: { id: string }) => w.id === 'cauri');
assert.ok(CAURI, 'cauri must exist in the stable registry');
assert.equal(CAURI.adapter.transport, 'discovery-adapter', 'cauri is a discovery-adapter entry');
const DEVNET_HOST: string = CAURI.adapter.networkHosts?.devnet;
assert.ok(DEVNET_HOST, 'cauri must advertise a devnet host');

/** A mock Cauri provider: answers the connect RPCs from memory, never hits the
 * network, and records the host it was built with and the methods it was asked. */
function makeMockCauri() {
  const calls: { createHosts: string[]; methods: string[] } = { createHosts: [], methods: [] };
  const provider = {
    request: async ({ method }: { method: string }) => {
      calls.methods.push(method);
      switch (method) {
        case 'connect': return { isConnected: true };
        case 'getPrimaryAccount': return { partyId: 'party::cauri-1', networkId: 'canton:da-devnet' };
        case 'status': return { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } };
        default: return null;
      }
    },
    on() { return provider; },
    emit() { return false; },
    removeListener() { return provider; },
  };
  const factory = {
    providerId: 'cauri',
    name: 'Cauri Wallet',
    create: (host: string) => {
      calls.createHosts.push(host);
      return { providerId: 'cauri', name: 'Cauri Wallet', type: 'browser', detect: async () => true, provider: () => provider };
    },
  };
  return { factory, calls };
}

/** A client wired like the kit-demo (default stable channel), but served the
 * real cauri entry from memory so nothing touches the network. */
function makeClient(adapters: unknown[]) {
  const client = createPartyLayer({
    network: 'devnet',
    channel: 'stable',
    app: { name: 'cauri kit-demo test', origin: 'https://test.example.com' },
    adapters: adapters as never,
  });
  client.registryClient.getWallets = async () => [registryEntryToWalletInfo(CAURI, 'stable')];
  client.registryClient.getRegistry = async () => ({ wallets: [CAURI] }) as never;
  client.registryClient.getWalletEntry = async (id: unknown) => {
    if (String(id) === 'cauri') return CAURI;
    throw new Error(`no entry ${String(id)}`);
  };
  return client;
}

test('APPEARS: a registered cauri factory surfaces cauri on stable with its registry name and icon', async () => {
  const { factory } = makeMockCauri();
  const client = makeClient([factory]);
  try {
    const wallets = await client.listWallets();
    const cauri = wallets.find((w) => String(w.walletId) === 'cauri');
    assert.ok(cauri, 'cauri should be listed when its factory is registered');
    assert.equal(cauri!.name, CAURI.name);
    assert.equal(cauri!.channel, 'stable');
    assert.equal(cauri!.icons?.md, CAURI.icon);
  } finally {
    client.destroy();
  }
});

test('ABSENT: without the factory, the discovery-adapter entry is gated out (no dead tile)', async () => {
  const client = makeClient([]);
  try {
    const wallets = await client.listWallets();
    assert.equal(wallets.find((w) => String(w.walletId) === 'cauri'), undefined, 'cauri must not be listed when unregistered');
  } finally {
    client.destroy();
  }
});

test('CONNECT REACHES THE ADAPTER: connect builds the official with the registry devnet host and drives its provider (no network)', async () => {
  const { factory, calls } = makeMockCauri();
  const client = makeClient([factory]);
  try {
    const session = await client.connect({ walletId: toWalletId('cauri') });
    assert.equal(String(session.walletId), 'cauri');
    assert.ok(calls.createHosts.includes(DEVNET_HOST), `factory.create should be called with the registry devnet host ${DEVNET_HOST}, got ${JSON.stringify(calls.createHosts)}`);
    assert.ok(calls.methods.includes('connect'), 'the adapter provider should receive the connect RPC');
  } finally {
    client.destroy();
  }
});
