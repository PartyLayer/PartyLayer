// @vitest-environment jsdom
/**
 * Console -> generic CIP-0103 announce path migration (Faz 2).
 *
 * Proves: with ConsoleAdapter NO LONGER in getBuiltinAdapters() defaults, a
 * Console announcing on canton:announceProvider (flat detail, id lpnf…) is
 * served by an auto-configured GenericAnnounceAdapter (registry
 * transport:'announce'), connectable, with the SAME single-entry guarantees as
 * the bespoke path. Also pins the networkId-resolution fix for Console AND Send.
 *
 * Source touched by this migration:
 *   - registry console entry: adapter.transport:'announce' + config.restore.
 *   - builtin-adapters.ts: ConsoleAdapter removed from defaults (still exported).
 *   - announce-adapter.ts: network capture now filters by isRecognizedNetwork
 *     (mirrors discovery-adapter.ts:243-246), so Console's account.networkId
 *     "CANTON_NETWORK" (unrecognized) no longer becomes session.network and no
 *     longer trips a false-positive detectNetworkMismatch (client.ts:631).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// createPartyLayer pulls getBuiltinAdapters transitively, which imports the
// ConsoleAdapter module (its SVG imports explode under Node) — stub the SDK.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  detectNetworkMismatch,
  toWalletId,
  type AdapterContext,
  type CIP0103Provider,
  type WalletInfo,
} from '@partylayer/core';
import { createPartyLayer } from './client';
import { GenericAnnounceAdapter } from './announce-adapter';

const CONSOLE_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';
const SEND_ID = 'ldmohiccoioolenadmogclhoklmanpgi';

type Rec = CIP0103Provider & { calls: Array<{ method: string; params?: unknown }> };

/**
 * Console-shaped provider per the VERIFIED real extension:
 *  - status() has NO network field; status().provider.id == CONSOLE_ID
 *  - getPrimaryAccount().networkId == "CANTON_NETWORK" (no devnet/testnet/mainnet)
 *  - prepareExecute EXISTS (generic submit is viable)
 */
function consoleRecorder(): Rec {
  const calls: Array<{ method: string; params?: unknown }> = [];
  const p = {
    calls,
    request: async ({ method, params }: { method: string; params?: unknown }) => {
      calls.push({ method, params });
      if (method === 'status') return { provider: { id: CONSOLE_ID } }; // NO network
      if (method === 'getPrimaryAccount')
        return { partyId: 'party::console', publicKey: 'pk', networkId: 'CANTON_NETWORK' };
      if (method === 'connect') return { isConnected: true };
      if (method === 'prepareExecute') return { transactionHash: '0xupdate', submittedAt: 1 };
      return {};
    },
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as Rec;
}

/** Send-shaped provider whose status() reports a RECOGNIZED network. */
function sendRecorder(opts: { statusNetwork?: string } = {}): Rec {
  const calls: Array<{ method: string; params?: unknown }> = [];
  const p = {
    calls,
    request: async ({ method, params }: { method: string; params?: unknown }) => {
      calls.push({ method, params });
      if (method === 'status')
        return opts.statusNetwork ? { network: { networkId: opts.statusNetwork } } : {};
      if (method === 'getPrimaryAccount')
        return { partyId: 'party::send', publicKey: 'pk', networkId: 'CANTON_NETWORK' };
      if (method === 'connect') return { isConnected: true };
      return {};
    },
    on() {
      return p;
    },
    emit() {
      return true;
    },
    removeListener() {
      return p;
    },
  };
  return p as unknown as Rec;
}

const ctx = (network: string): AdapterContext => ({ network } as unknown as AdapterContext);

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).canton;
  vi.restoreAllMocks();
});

// ── networkId fix: Console ────────────────────────────────────────────────────
describe('networkId resolution (Console): unrecognized account network -> ctx.network', () => {
  it('BEFORE (old resolution) would false-positive; AFTER resolves to ctx.network, no mismatch', async () => {
    // BEFORE: `reportedNetwork ?? account.networkId ?? ctx.network`. With Console:
    // reportedNetwork undefined, account.networkId "CANTON_NETWORK" => session.network
    // would be "CANTON_NETWORK".
    const oldResolved = (undefined as string | undefined) ?? 'CANTON_NETWORK' ?? 'devnet';
    expect(oldResolved).toBe('CANTON_NETWORK');
    // That trips a FALSE-POSITIVE mismatch (CANTON_NETWORK normalizes outside KNOWN_CAIP2):
    expect(detectNetworkMismatch('devnet', oldResolved)).not.toBeNull();

    // AFTER: the fixed GenericAnnounceAdapter falls back to ctx.network.
    const adapter = new GenericAnnounceAdapter({
      announceId: CONSOLE_ID,
      walletId: toWalletId('console'),
      provider: consoleRecorder(),
    });
    const res = await adapter.connect(ctx('devnet'));
    expect(res.session.network).toBe('devnet'); // NOT "CANTON_NETWORK"
    expect(detectNetworkMismatch('devnet', res.session.network!)).toBeNull(); // no false positive
  });
});

// ── networkId fix: Send (must NOT regress) ───────────────────────────────────
describe('networkId resolution (Send): recognized report preserved; latent false-positive removed', () => {
  it('Send reporting a RECOGNIZED status network is UNCHANGED (no regression)', async () => {
    const adapter = new GenericAnnounceAdapter({
      announceId: SEND_ID,
      walletId: toWalletId('send'),
      provider: sendRecorder({ statusNetwork: 'canton:da-mainnet' }),
    });
    const res = await adapter.connect(ctx('mainnet'));
    // BEFORE and AFTER both pick the recognized reported network (it is first + recognized).
    expect(res.session.network).toBe('canton:da-mainnet');
    expect(detectNetworkMismatch('mainnet', res.session.network!)).toBeNull();
  });

  it('Send reporting NO network (account "CANTON_NETWORK") -> ctx.network (latent fix)', async () => {
    // BEFORE: would be "CANTON_NETWORK" (false positive). AFTER: ctx.network.
    const oldResolved = (undefined as string | undefined) ?? 'CANTON_NETWORK' ?? 'mainnet';
    expect(detectNetworkMismatch('mainnet', oldResolved)).not.toBeNull();

    const adapter = new GenericAnnounceAdapter({
      announceId: SEND_ID,
      walletId: toWalletId('send'),
      provider: sendRecorder(), // no status network
    });
    const res = await adapter.connect(ctx('mainnet'));
    expect(res.session.network).toBe('mainnet');
    expect(detectNetworkMismatch('mainnet', res.session.network!)).toBeNull();
  });
});

// ── prepareExecute reachable through the generic adapter for Console ──────────
describe('Console generic submit: submitTransaction -> prepareExecute', () => {
  it('drives the Console-shaped provider through connect + prepareExecute', async () => {
    const provider = consoleRecorder();
    const adapter = new GenericAnnounceAdapter({
      announceId: CONSOLE_ID,
      walletId: toWalletId('console'),
      provider,
    });
    const connected = await adapter.connect(ctx('devnet'));
    await adapter.submitTransaction(ctx('devnet'), { ...connected.session } as never, { signedTx: { commands: [] } } as never);

    const methods = provider.calls.map((c) => c.method);
    expect(methods).toContain('connect');
    expect(methods).toContain('getPrimaryAccount');
    expect(methods).toContain('prepareExecute'); // generic submit maps here
    expect(adapter.getCapabilities()).toEqual(
      expect.arrayContaining(['connect', 'signMessage', 'submitTransaction']),
    );
  });
});

// ── Client-level: Console connectable via the bridge WITHOUT ConsoleAdapter ──
describe('Console served by the generic announce bridge (no ConsoleAdapter)', () => {
  // Registry console entry AFTER this migration: transport:'announce' + config.
  const CONSOLE_ANNOUNCE_ENTRY = {
    id: 'console',
    adapter: { type: '@partylayer/adapter-console', transport: 'announce', config: { restore: true } },
  };
  function consoleWalletInfo(): WalletInfo {
    return {
      walletId: toWalletId('console'),
      name: 'Console Wallet',
      website: '',
      icons: {},
      capabilities: ['connect', 'signMessage', 'submitTransaction'],
      adapter: { packageName: '@partylayer/adapter-console', versionRange: '*' },
      docs: [],
      networks: ['devnet'],
      channel: 'stable',
      providerDetection: {
        transport: 'window.canton',
        matchers: [{ field: 'provider.id', match: 'exact', values: [CONSOLE_ID] }],
      },
    } as unknown as WalletInfo;
  }

  beforeEach(() => vi.clearAllMocks());

  it('Console announce (lpnf) => one "console" served by a GenericAnnounceAdapter, connectable', async () => {
    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'faz2', origin: 'https://test.example.com' },
      discovery: { announceTimeoutMs: 0 },
      adapters: [], // NO ConsoleAdapter — proves the generic path stands alone
    });
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([consoleWalletInfo()]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
    vi.spyOn(client.registryClient, 'getWalletEntry').mockResolvedValue(CONSOLE_ANNOUNCE_ENTRY as never);

    window.dispatchEvent(
      new CustomEvent('canton:announceProvider', {
        detail: { id: CONSOLE_ID, name: 'Console Wallet', target: CONSOLE_ID },
      }),
    );
    await new Promise((r) => setTimeout(r, 40));

    const ids = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(ids.filter((id) => id === 'console')).toHaveLength(1); // single entry
    expect(ids).not.toContain(`browser:ext:${CONSOLE_ID}`); // bridged, no dynamic dup
    expect(ids).not.toContain('browser:ext:canton'); // no phantom

    // Served by the generic announce adapter (transport:'announce' bridge), connectable.
    const adapter = client.getAdapter('console');
    expect(adapter).toBeInstanceOf(GenericAnnounceAdapter);
    expect(adapter!.getCapabilities()).toEqual(
      expect.arrayContaining(['connect', 'signMessage', 'submitTransaction', 'restore']),
    );

    client.destroy();
  });

  it('Console (lpnf) + Send (ldmohi) announce together, NO bespoke adapters => two distinct generic entries', async () => {
    const sendWalletInfo = (): WalletInfo =>
      ({
        walletId: toWalletId('send'),
        name: 'Send',
        website: '',
        icons: {},
        capabilities: ['connect', 'signMessage', 'submitTransaction'],
        adapter: { packageName: '@partylayer/adapter-send', versionRange: '*' },
        docs: [],
        networks: ['mainnet'],
        channel: 'stable',
        providerDetection: {
          transport: 'window.canton',
          matchers: [{ field: 'provider.id', match: 'exact', values: [SEND_ID] }],
        },
      }) as unknown as WalletInfo;
    const SEND_ANNOUNCE_ENTRY = {
      id: 'send',
      adapter: { type: '@partylayer/adapter-send', transport: 'announce', config: { restore: true } },
    };

    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'faz2-both', origin: 'https://test.example.com' },
      discovery: { announceTimeoutMs: 0 },
      adapters: [], // NEITHER bespoke adapter — both via the generic path
    });
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([consoleWalletInfo(), sendWalletInfo()]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
    vi.spyOn(client.registryClient, 'getWalletEntry').mockImplementation(
      async (id: string) => (id === 'send' ? SEND_ANNOUNCE_ENTRY : CONSOLE_ANNOUNCE_ENTRY) as never,
    );

    for (const [id, name] of [[CONSOLE_ID, 'Console Wallet'], [SEND_ID, 'Send']] as const) {
      window.dispatchEvent(new CustomEvent('canton:announceProvider', { detail: { id, name, target: id } }));
    }
    await new Promise((r) => setTimeout(r, 40));

    const ids = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(ids.filter((id) => id === 'console')).toHaveLength(1);
    expect(ids.filter((id) => id === 'send')).toHaveLength(1);
    expect(ids.some((id) => id.startsWith('browser:ext:'))).toBe(false); // no dup/phantom
    // Both served by their OWN generic adapter; neither claims the other.
    expect(client.getAdapter('console')).toBeInstanceOf(GenericAnnounceAdapter);
    expect(client.getAdapter('send')).toBeInstanceOf(GenericAnnounceAdapter);
    expect(client.getAdapter('console')).not.toBe(client.getAdapter('send'));

    client.destroy();
  });
});
