/**
 * Registry-visibility gating for `transport: 'discovery-adapter'` entries.
 *
 * Such a wallet's provider is supplied by the APP (an official ProviderAdapter
 * the SDK bridges). The entry must surface in listWallets ONLY when the matching
 * adapter is registered — otherwise a consumer who didn't wire it sees the
 * wallet and gets a broken click (no adapter → connect throws).
 */
import { describe, it, expect, vi } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters transitively (Console SDK imports
// SVGs that explode under Node) — stub at the boundary.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import { toWalletId, type OfficialProviderAdapter } from '@partylayer/core';
import { registryEntryToWalletInfo, type RegistryWalletEntry, type WalletRegistryV1 } from '@partylayer/registry-client';
import { createPartyLayer } from './client';

const WALLEY_ENTRY: RegistryWalletEntry = {
  id: 'walley',
  name: 'Walley',
  supportedNetworks: ['devnet'],
  capabilities: {
    signMessage: true,
    signTransaction: false,
    submitTransaction: true,
    transactionStatus: true,
    switchNetwork: false,
    multiParty: false,
  },
  adapter: { type: '@k2flabs/walley-dapp-sdk', transport: 'discovery-adapter', config: { providerId: 'walley' } },
};

// A normal (non-discovery) registry entry — must NEVER be gated.
const NORMAL_ENTRY: RegistryWalletEntry = {
  id: 'console',
  name: 'Console Wallet',
  supportedNetworks: ['devnet'],
  capabilities: {
    signMessage: true,
    signTransaction: true,
    submitTransaction: true,
    transactionStatus: true,
    switchNetwork: false,
    multiParty: false,
  },
  adapter: { type: '@partylayer/adapter-console' },
};

function registryWith(entries: RegistryWalletEntry[]): WalletRegistryV1 {
  return {
    metadata: { registryVersion: '1.0.0', schemaVersion: 1, publishedAt: '2026-01-01T00:00:00Z' },
    wallets: entries,
  } as unknown as WalletRegistryV1;
}

function fakeWalleyOfficial(): OfficialProviderAdapter {
  const provider = {
    request: async () => undefined,
    on() { return provider; },
    emit() { return false; },
    removeListener() { return provider; },
  };
  return { providerId: 'walley', name: 'Walley', detect: async () => true, provider: () => provider };
}

/** Build a client whose registry returns `entries` (both getRegistry + getWallets). */
function clientWithRegistry(entries: RegistryWalletEntry[], adapters: OfficialProviderAdapter[] = []) {
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'gating test', origin: 'https://test.example.com' },
    // Empty array (not undefined) → no builtin adapters; only what we pass.
    adapters,
  });
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue(registryWith(entries));
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue(
    entries.map((e) => registryEntryToWalletInfo(e, 'stable')),
  );
  return client;
}

describe('discovery-adapter registry-visibility gating', () => {
  it('HIDES a discovery-adapter entry when no matching adapter is registered', async () => {
    const client = clientWithRegistry([WALLEY_ENTRY], []);
    const wallets = await client.listWallets({ includeExperimental: true });
    expect(wallets.find((w) => String(w.walletId) === 'walley')).toBeUndefined();
  });

  it('SHOWS a discovery-adapter entry when the matching adapter IS registered', async () => {
    const client = clientWithRegistry([WALLEY_ENTRY], [fakeWalleyOfficial()]);
    expect(client.getAdapter(toWalletId('walley'))).toBeDefined(); // app adapter auto-bridged
    const wallets = await client.listWallets({ includeExperimental: true });
    expect(wallets.find((w) => String(w.walletId) === 'walley')).toBeDefined();
  });

  it('NEVER gates a normal (non-discovery) entry, registered or not', async () => {
    const client = clientWithRegistry([NORMAL_ENTRY], []);
    const wallets = await client.listWallets({ includeExperimental: true });
    expect(wallets.find((w) => String(w.walletId) === 'console')).toBeDefined();
  });

  it('is a no-op when the registry is unavailable (adapters-only list)', async () => {
    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'gating test', origin: 'https://test.example.com' },
      adapters: [fakeWalleyOfficial()],
    });
    vi.spyOn(client.registryClient, 'getWallets').mockRejectedValue(new Error('offline'));
    vi.spyOn(client.registryClient, 'getRegistry').mockRejectedValue(new Error('offline'));
    // Registered adapter still surfaces via the adapter-merge path (not gated away).
    const wallets = await client.listWallets({ includeExperimental: true });
    expect(wallets.find((w) => String(w.walletId) === 'walley')).toBeDefined();
  });
});
