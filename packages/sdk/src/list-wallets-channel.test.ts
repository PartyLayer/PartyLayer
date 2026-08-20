/**
 * listWallets must filter to the client's CONFIGURED channel, not to the literal
 * 'stable'. Before the fix, a client on channel 'beta' saw an empty list because
 * every beta entry carries channel 'beta' and the filter compared against 'stable'
 * (the channel option existed but never affected listing). A stable client is
 * unchanged; includeExperimental still returns everything, unfiltered.
 *
 * Both fixtures use announce transport so registry-visibility gating keeps them
 * with no adapter registered (announce is exempt); the ONLY variable under test is
 * the channel filter. See discovery-gating.test.ts for the gating rules.
 */
import { describe, it, expect, vi } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters transitively (Console SDK imports SVGs
// that explode under Node) - stub at the boundary, as the gating test does.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import { registryEntryToWalletInfo, type RegistryWalletEntry, type WalletRegistryV1 } from '@partylayer/registry-client';
import { createPartyLayer } from './client';

const CAPS = {
  signMessage: true,
  signTransaction: false,
  submitTransaction: true,
  transactionStatus: true,
  switchNetwork: false,
  multiParty: false,
} as const;

const STABLE_ENTRY: RegistryWalletEntry = {
  id: 'stableWallet',
  name: 'Stable Wallet',
  supportedNetworks: ['devnet'],
  capabilities: { ...CAPS },
  adapter: { type: '@partylayer/adapter-console', transport: 'announce' },
};

const BETA_ENTRY: RegistryWalletEntry = {
  id: 'betaWallet',
  name: 'Beta Wallet',
  supportedNetworks: ['devnet'],
  capabilities: { ...CAPS },
  adapter: { type: '@partylayer/adapter-console', transport: 'announce' },
};

/** One entry tagged stable, one tagged beta, both returned by getWallets so the
 * filter is what decides which of the two survives. */
const MIX: Array<{ entry: RegistryWalletEntry; channel: 'stable' | 'beta' }> = [
  { entry: STABLE_ENTRY, channel: 'stable' },
  { entry: BETA_ENTRY, channel: 'beta' },
];

function registryWith(entries: RegistryWalletEntry[]): WalletRegistryV1 {
  return {
    metadata: { registryVersion: '1.0.0', schemaVersion: 1, publishedAt: '2026-01-01T00:00:00Z' },
    wallets: entries,
  } as unknown as WalletRegistryV1;
}

function clientOn(channel?: 'stable' | 'beta') {
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'channel test' },
    // Empty array (not undefined) -> no builtin adapters; nothing to synthesize.
    adapters: [] as never,
    ...(channel ? { channel } : {}),
  });
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue(registryWith(MIX.map((w) => w.entry)));
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue(
    MIX.map((w) => registryEntryToWalletInfo(w.entry, w.channel)),
  );
  return client;
}

const ids = async (client: ReturnType<typeof clientOn>, filter?: { includeExperimental: true }) =>
  (await client.listWallets(filter)).map((w) => String(w.walletId)).sort();

describe('listWallets filters to the configured channel', () => {
  it('a stable client lists stable entries and not beta (unchanged behavior)', async () => {
    expect(await ids(clientOn('stable'))).toEqual(['stableWallet']);
  });

  it('a beta client lists beta entries (the fix: before, this was empty)', async () => {
    expect(await ids(clientOn('beta'))).toEqual(['betaWallet']);
  });

  it('includeExperimental returns every channel, unfiltered', async () => {
    expect(await ids(clientOn('beta'), { includeExperimental: true })).toEqual(['betaWallet', 'stableWallet']);
  });

  it('an unset channel defaults to stable', async () => {
    expect(await ids(clientOn())).toEqual(['stableWallet']);
  });
});
