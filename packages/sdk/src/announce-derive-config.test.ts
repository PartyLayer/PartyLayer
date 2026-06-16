// @vitest-environment jsdom
/**
 * (e) deriveAnnounceConfig maps a registry announce entry → AnnounceAdapterConfig.
 *
 * Isolated by mocking ONLY the GenericAnnounceAdapter class with a recording stub
 * (the real announcedWalletId/prefix are kept via importActual), so we can capture
 * the exact `config` the bridge constructs from the registry entry — proving the
 * mapping (events/restore/ledgerApi/metadata + staticMetadata string-only filter).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

const captured: Array<{ walletId?: string; config?: Record<string, unknown> }> = [];

vi.mock('./announce-adapter', async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>;
  class RecordingAnnounceAdapter {
    walletId: string;
    name: string;
    config?: Record<string, unknown>;
    constructor(args: { announceId: string; walletId?: string; name?: string; config?: Record<string, unknown> }) {
      this.walletId = args.walletId ?? `browser:ext:${args.announceId}`;
      this.name = args.name ?? 'rec';
      this.config = args.config;
      captured.push({ walletId: this.walletId, config: args.config });
    }
    getCapabilities() {
      return ['connect'];
    }
  }
  return { ...actual, GenericAnnounceAdapter: RecordingAnnounceAdapter };
});

import { toWalletId, WalletNotFoundError, type WalletInfo } from '@partylayer/core';
import { createPartyLayer } from './client';

function announce(id: string): void {
  window.dispatchEvent(
    new CustomEvent('canton:announceProvider', { detail: { providerId: id, name: id, target: id } }),
  );
}

const genericWalletInfo = (): WalletInfo =>
  ({
    walletId: toWalletId('genericw'),
    name: 'genericw',
    website: '',
    icons: {},
    capabilities: ['connect', 'signMessage', 'submitTransaction'],
    adapter: { packageName: 'x', versionRange: '*' },
    docs: [],
    networks: ['devnet'],
    channel: 'stable',
    providerDetection: { matchers: [{ field: 'provider.id', match: 'exact', values: ['genid'] }] },
  }) as unknown as WalletInfo;

describe('(e) deriveAnnounceConfig — registry → config mapping', () => {
  it('maps capabilities.events + adapter.config.{restore,ledgerApi,metadata,staticMetadata}; drops non-string static values', async () => {
    captured.length = 0;
    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'derive', origin: 'https://test.example.com' },
      discovery: { announceTimeoutMs: 0 },
      adapters: [], // no registered adapter for 'genericw' → bridge takes the configured branch
    });
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([genericWalletInfo()]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
    vi.spyOn(client.registryClient, 'getWalletEntry').mockImplementation(async (id: string) => {
      if (id === 'genericw') {
        return {
          id,
          adapter: {
            transport: 'announce',
            config: {
              restore: true,
              ledgerApi: true,
              metadata: true,
              // string-only filter: signingMethod kept, bad (number) dropped.
              staticMetadata: { signingMethod: 'webauthn-prf', bad: 123 },
            },
          },
          capabilities: { events: true },
        } as never;
      }
      throw new WalletNotFoundError(id);
    });

    announce('genid');
    await new Promise((r) => setTimeout(r, 40));
    await client.listWallets({ includeExperimental: true });

    const rec = captured.find((c) => c.walletId === 'genericw');
    expect(rec).toBeDefined();
    expect(rec!.config).toMatchObject({ events: true, restore: true, ledgerApi: true, metadata: true });
    // staticMetadata: string value kept, non-string dropped.
    expect(rec!.config!.staticMetadata).toEqual({ signingMethod: 'webauthn-prf' });
    client.destroy();
  });
});
