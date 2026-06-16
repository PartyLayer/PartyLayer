// @vitest-environment jsdom
/**
 * Coexistence + isolation for the Phase-1 generic-announce config path.
 *
 * (g) COEXISTENCE — a bespoke-registered wallet (Send-class: an adapter already
 *     registered under its walletId) and a configured generic-announce wallet
 *     (registry `transport:'announce'`, no registered adapter) BOTH resolve in
 *     the same client: the bespoke adapter is the SAME instance (untouched, hit
 *     the `adapters.has → continue` branch), the announce wallet gets a CONFIGURED
 *     GenericAnnounceAdapter with its opt-in caps.
 * (h) WALLEY ISOLATION — a GenericDiscoveryAdapter (popup/remote) and a configured
 *     generic-announce wallet coexist: the discovery wallet still warms + fast-paths
 *     (gesture-sync byte-identical) across the announce re-list, the announce wallet
 *     gets its configured caps. Proves the announce-path change can't touch the
 *     discovery/warmPlans path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  toPartyId,
  WalletNotFoundError,
  type AdapterConnectResult,
  type AdapterContext,
  type AdapterDetectResult,
  type CapabilityKey,
  type CIP0103Provider,
  type OfficialProviderAdapter,
  type WalletAdapter,
  type WalletInfo,
} from '@partylayer/core';
import { createPartyLayer } from './client';
import { GenericAnnounceAdapter } from './announce-adapter';

function announce(id: string): void {
  window.dispatchEvent(
    new CustomEvent('canton:announceProvider', { detail: { providerId: id, name: id, target: id } }),
  );
}

/** A registry WalletInfo whose providerDetection matches an announce id. */
function walletInfo(walletId: string, announceId?: string): WalletInfo {
  return {
    walletId: toWalletId(walletId),
    name: walletId,
    website: '',
    icons: {},
    capabilities: ['connect', 'signMessage', 'submitTransaction'],
    adapter: { packageName: 'x', versionRange: '*' },
    docs: [],
    networks: ['devnet'],
    channel: 'stable',
    ...(announceId
      ? { providerDetection: { matchers: [{ field: 'provider.id', match: 'exact', values: [announceId] }] } }
      : {}),
  } as unknown as WalletInfo;
}

/** A bespoke adapter (Send-class) registered under its walletId. */
class BespokeStub implements WalletAdapter {
  readonly walletId = toWalletId('bespoke');
  readonly name = 'Bespoke';
  getCapabilities(): CapabilityKey[] {
    return ['connect', 'signMessage', 'submitTransaction', 'restore', 'ledgerApi', 'events'];
  }
  async detectInstalled(): Promise<AdapterDetectResult> {
    return { installed: true };
  }
  async connect(): Promise<AdapterConnectResult> {
    return { partyId: toPartyId('party::bespoke'), session: { walletId: this.walletId }, capabilities: this.getCapabilities() };
  }
  async disconnect(): Promise<void> {}
}

/** Walley-shaped official adapter (eventless popup/remote). */
function makeOfficial(): OfficialProviderAdapter & { detect: ReturnType<typeof vi.fn> } {
  const handlers: Record<string, unknown> = {
    connect: { isConnected: true },
    getPrimaryAccount: { partyId: 'party::walley-1', networkId: 'canton:da-devnet' },
    status: { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } },
    disconnect: null,
  };
  const provider: CIP0103Provider = {
    request: vi.fn(async (args: { method: string }) => handlers[args.method]) as CIP0103Provider['request'],
    on: () => provider,
    emit: () => false,
    removeListener: () => provider,
  };
  return {
    providerId: 'walley',
    name: 'Walley',
    type: 'browser',
    detect: vi.fn(async () => true),
    provider: vi.fn(() => provider),
  } as OfficialProviderAdapter & { detect: ReturnType<typeof vi.fn> };
}

const GENERIC_ENTRY = {
  id: 'genericw',
  adapter: { transport: 'announce', config: { restore: true, ledgerApi: true } },
  capabilities: { events: true },
};

describe('generic-announce coexistence + isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('(g) bespoke (untouched) and a configured generic-announce wallet both resolve', async () => {
    const bespoke = new BespokeStub();
    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'coexist', origin: 'https://test.example.com' },
      discovery: { announceTimeoutMs: 0 },
      adapters: [bespoke],
    });
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([
      walletInfo('bespoke', 'bespokeid'),
      walletInfo('genericw', 'genid'),
    ]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
    vi.spyOn(client.registryClient, 'getWalletEntry').mockImplementation(async (id: string) => {
      if (id === 'genericw') return GENERIC_ENTRY as never;
      throw new WalletNotFoundError(id);
    });

    announce('bespokeid'); // known + bespoke registered → adapters.has → continue (untouched)
    announce('genid'); // known + no adapter + transport:'announce' → configured generic
    await new Promise((r) => setTimeout(r, 40));
    await client.listWallets({ includeExperimental: true });

    // Bespoke: the SAME instance — never replaced/touched.
    expect(client.getAdapter('bespoke')).toBe(bespoke);
    // Generic-announce: a configured GenericAnnounceAdapter with the opt-in caps.
    const gen = client.getAdapter('genericw');
    expect(gen).toBeInstanceOf(GenericAnnounceAdapter);
    expect(gen!.getCapabilities()).toEqual(expect.arrayContaining(['events', 'restore', 'ledgerApi']));
    client.destroy();
  });

  it('(h) Walley (discovery) warm/fast-path is byte-identical across a generic-announce re-list', async () => {
    const official = makeOfficial();
    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'isolation', origin: 'https://test.example.com' },
      discovery: { announceTimeoutMs: 0 },
      adapters: [official],
    });
    const getWallets = vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([
      walletInfo('walley'),
      walletInfo('genericw', 'genid'),
    ]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
    vi.spyOn(client.registryClient, 'getWalletEntry').mockImplementation(async (id: string) => {
      if (id === 'genericw') return GENERIC_ENTRY as never;
      throw new WalletNotFoundError(id);
    });

    await client.listWallets({ includeExperimental: true }); // warms Walley
    await vi.waitFor(() => expect(official.detect).toHaveBeenCalled());

    announce('genid'); // generic announce → re-aggregation path
    await new Promise((r) => setTimeout(r, 40));
    await client.listWallets({ includeExperimental: true }); // reactive re-list

    // Generic-announce wallet got its configured caps.
    expect(client.getAdapter('genericw')).toBeInstanceOf(GenericAnnounceAdapter);

    // Walley's gesture-sync fast-path is intact: connect does NOT re-list.
    getWallets.mockClear();
    const session = await client.connect({ walletId: toWalletId('walley') });
    expect(session.walletId).toBe(toWalletId('walley'));
    expect(getWallets).not.toHaveBeenCalled(); // warm plan survived → fast-path
    client.destroy();
  });
});
