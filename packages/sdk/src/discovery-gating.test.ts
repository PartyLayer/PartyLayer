/**
 * Registry-visibility gating (the library default, RainbowKit-style): never show
 * a wallet the app cannot actually connect.
 *
 * A wallet is connectable with NO app adapter ONLY when it is driven by the
 * generic announce path (`adapter.transport: 'announce'`, e.g. Console, Send):
 * installing the extension is enough. Every other transport needs an adapter the
 * app registered: a `discovery-adapter` popup/remote wallet whose official
 * ProviderAdapter the app supplies, or a wallet that ships a PartyLayer adapter
 * package (Loop, Cantor8, Nightly, Bron, WalletConnect). Such an entry surfaces
 * in listWallets ONLY when the matching adapter is registered; otherwise a
 * consumer who didn't wire it sees the wallet and gets a broken click (connect
 * throws). The classification is read from the DECLARED transport, not a list.
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

import { toWalletId, toPartyId, type OfficialProviderAdapter, type WalletAdapter } from '@partylayer/core';
import { registryEntryToWalletInfo, type RegistryWalletEntry, type WalletRegistryV1 } from '@partylayer/registry-client';
import { createPartyLayer } from './client';

const FULL_CAPS = {
  signMessage: true,
  signTransaction: false,
  submitTransaction: true,
  transactionStatus: true,
  switchNetwork: false,
  multiParty: false,
} as const;

/** A `discovery-adapter` wallet (official ProviderAdapter supplied by the app). */
const WALLEY_ENTRY: RegistryWalletEntry = {
  id: 'walley',
  name: 'Walley',
  supportedNetworks: ['devnet'],
  capabilities: { ...FULL_CAPS },
  adapter: { type: '@k2flabs/walley-dapp-sdk', transport: 'discovery-adapter', config: { providerId: 'walley' } },
};

/** A wallet that ships a PartyLayer adapter package (non-announce), so it needs
 * that adapter registered to be connectable (must be gated when it is absent). */
const BESPOKE_ENTRY: RegistryWalletEntry = {
  id: 'cantor8',
  name: 'Cantor8',
  supportedNetworks: ['devnet'],
  capabilities: { ...FULL_CAPS },
  adapter: { type: '@partylayer/adapter-cantor8' },
};

/** An announce-transport wallet (the genuine exception): connectable with no
 * app adapter (the SDK drives it from the entry), so it must NEVER be gated. */
const ANNOUNCE_ENTRY: RegistryWalletEntry = {
  id: 'console',
  name: 'Console Wallet',
  supportedNetworks: ['devnet'],
  capabilities: { ...FULL_CAPS, signTransaction: true },
  adapter: { type: '@partylayer/adapter-console', transport: 'announce' },
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

/** A minimal packaged WalletAdapter (no providerId/detect/provider, so the
 * client registers it as a plain WalletAdapter keyed by its walletId). */
function fakeBespokeAdapter(id: string): WalletAdapter {
  const walletId = toWalletId(id);
  return {
    walletId,
    name: id,
    getCapabilities: () => ['connect', 'disconnect'],
    detectInstalled: async () => ({ installed: true }),
    connect: async () => ({
      partyId: toPartyId(`party::${id}`),
      session: { walletId, network: 'devnet', createdAt: 0 },
      capabilities: ['connect'],
    }),
    disconnect: async () => {},
  } as unknown as WalletAdapter;
}

/** Build a client whose registry returns `entries` (both getRegistry + getWallets). */
function clientWithRegistry(
  entries: RegistryWalletEntry[],
  adapters: Array<OfficialProviderAdapter | WalletAdapter> = [],
) {
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'gating test', origin: 'https://test.example.com' },
    // Empty array (not undefined) → no builtin adapters; only what we pass.
    adapters: adapters as never,
  });
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue(registryWith(entries));
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue(
    entries.map((e) => registryEntryToWalletInfo(e, 'stable')),
  );
  return client;
}

async function listedIds(client: ReturnType<typeof clientWithRegistry>) {
  const wallets = await client.listWallets({ includeExperimental: true });
  return wallets.map((w) => String(w.walletId));
}

describe('registry-visibility gating (adapter-registration required, announce exempt)', () => {
  it('HIDES a discovery-adapter entry when its adapter is NOT registered', async () => {
    const ids = await listedIds(clientWithRegistry([WALLEY_ENTRY], []));
    expect(ids).not.toContain('walley');
  });

  it('SHOWS a discovery-adapter entry when its adapter IS registered', async () => {
    const client = clientWithRegistry([WALLEY_ENTRY], [fakeWalleyOfficial()]);
    expect(client.getAdapter(toWalletId('walley'))).toBeDefined(); // app adapter auto-bridged
    expect(await listedIds(client)).toContain('walley');
  });

  it('HIDES a packaged-adapter (non-announce) entry when its adapter is NOT registered', async () => {
    const ids = await listedIds(clientWithRegistry([BESPOKE_ENTRY], []));
    expect(ids).not.toContain('cantor8');
  });

  it('SHOWS a packaged-adapter entry when its adapter IS registered', async () => {
    const ids = await listedIds(clientWithRegistry([BESPOKE_ENTRY], [fakeBespokeAdapter('cantor8')]));
    expect(ids).toContain('cantor8');
  });

  it('NEVER gates an announce-transport entry, with or without an adapter', async () => {
    // No adapter registered: the SDK drives announce wallets from the entry.
    expect(await listedIds(clientWithRegistry([ANNOUNCE_ENTRY], []))).toContain('console');
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
