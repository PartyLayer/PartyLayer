// @vitest-environment jsdom
/**
 * A2 — SDK-level announce aggregation + identity bridge + per-click isolation.
 *
 * `discoverProviders` is mocked to return controlled DiscoveredProviders (each a
 * recording CIP-0103 provider), so these tests pin the SDK's merge/bridge/route
 * logic deterministically. The REAL target-channel routing is covered by the
 * provider suite (announce-discovery / extension-channel) and the env-gated
 * Playwright spec; here the recorder identity stands in for "which wallet's
 * channel was reached" — proving a click on wallet X only ever touches X.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Barrel pulls Console's SDK (SVG imports explode under Node) — stub it.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

// Control discoverProviders; keep the rest of @partylayer/provider real.
const discoverMock = vi.fn();
vi.mock('@partylayer/provider', async (orig) => {
  const actual = await orig<typeof import('@partylayer/provider')>();
  return { ...actual, discoverProviders: (opts: unknown) => discoverMock(opts) };
});

// Console's VERIFIED announce id (lpnf…) — anchors the identity bridge.
const CONSOLE_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';

// Registry returns Console WITH providerDetection (the bridge target).
const registryWallets = [
  {
    walletId: 'console',
    name: 'Console Wallet',
    website: '',
    icons: {},
    capabilities: ['connect'],
    adapter: { packageName: '@partylayer/adapter-console', versionRange: '*' },
    docs: [],
    networks: ['devnet'],
    channel: 'stable',
    providerDetection: {
      transport: 'window.canton',
      matchers: [{ field: 'provider.id', match: 'exact', values: [CONSOLE_ID] }],
    },
  },
];
vi.mock('@partylayer/registry-client', () => ({
  RegistryClient: class {
    async getWallets() {
      return registryWallets;
    }
    getStatus() {
      return null;
    }
    async getWalletEntry() {
      return { originAllowlist: [] }; // no origin restriction
    }
    async getWallet() {
      return undefined;
    }
  },
}));

import { createPartyLayer } from './client';

/** A recording CIP-0103 provider — tracks every method it is asked to run. */
function recorder(networkId = 'canton:da-devnet') {
  const calls: string[] = [];
  const p = {
    calls,
    request: async ({ method }: { method: string }) => {
      calls.push(method);
      if (method === 'getPrimaryAccount')
        return { partyId: 'party::' + method, publicKey: 'pk', networkId };
      if (method === 'status') return { network: { networkId } };
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
  return p as unknown as import('@partylayer/core').CIP0103Provider & { calls: string[] };
}

const storage = {
  get: async () => null,
  set: async () => {},
  remove: async () => {},
  clear: async () => {},
};
const crypto = {
  encrypt: async (d: unknown) => d,
  decrypt: async (d: unknown) => d,
  generateKey: async () => 'k',
};
const makeClient = () =>
  createPartyLayer({
    network: 'devnet',
    app: { name: 'a2-test', origin: 'https://e2e.example' },
    adapters: [], // no builtins — bridge uses the registry console entry
    storage: storage as never,
    crypto: crypto as never,
  });

beforeEach(() => discoverMock.mockReset());

describe('A2 SDK aggregation — listWallets', () => {
  it('surfaces an UNKNOWN announced wallet as a dynamic browser:ext:<id> entry', async () => {
    discoverMock.mockResolvedValue([
      { id: 'futurewallet', provider: recorder(), source: 'injected', name: 'Future Wallet', icon: 'data:i' },
    ]);
    const wallets = await makeClient().listWallets({ includeExperimental: true });
    const ids = wallets.map((w) => String(w.walletId));
    expect(ids).toContain('browser:ext:futurewallet');
    const entry = wallets.find((w) => String(w.walletId) === 'browser:ext:futurewallet')!;
    expect(entry.name).toBe('Future Wallet');
  });

  it('bridges a KNOWN announced id to the existing entry — NO duplicate', async () => {
    discoverMock.mockResolvedValue([
      { id: CONSOLE_ID, provider: recorder(), source: 'injected', name: 'Console Wallet' },
    ]);
    const wallets = await makeClient().listWallets({ includeExperimental: true });
    const ids = wallets.map((w) => String(w.walletId));
    expect(ids).toContain('console'); // existing registry entry
    expect(ids).not.toContain(`browser:ext:${CONSOLE_ID}`); // no dynamic dup
    expect(ids.filter((id) => id === 'console')).toHaveLength(1);
  });

  it('zero announcers → output identical to the no-discovery base', async () => {
    discoverMock.mockResolvedValue([]);
    const wallets = await makeClient().listWallets({ includeExperimental: true });
    expect(wallets.map((w) => String(w.walletId))).toEqual(['console']);
  });
});

describe('A2.1 — identity-less bare slot must NOT synthesize a phantom entry', () => {
  // Live incident (partylayer.xyz post-A2): Console's bare window.canton slot
  // exposes no provider.id and its status() probe yields none, so discovery's
  // injected key falls back to the path id 'canton' (identityResolved=false).
  // It must NOT become a "Canton Wallet" (browser:ext:canton) picker entry whose
  // provider is the slot itself (clicking it opens Console). It is dropped;
  // Console is represented by its resolved announce entry (lpnf…) → the console
  // adapter via the bridge.
  it('identity-less bare slot + Console announce ⇒ exactly ONE console entry, zero browser:ext:canton', async () => {
    discoverMock.mockResolvedValue([
      { id: 'canton', provider: recorder(), source: 'injected', name: 'Canton Wallet', identityResolved: false },
      { id: CONSOLE_ID, provider: recorder(), source: 'injected', name: 'Console Wallet', identityResolved: true },
    ]);
    const wallets = await makeClient().listWallets({ includeExperimental: true });
    const ids = wallets.map((w) => String(w.walletId));
    expect(ids).not.toContain('browser:ext:canton'); // the phantom
    expect(ids.filter((id) => id === 'console')).toHaveLength(1);
  });

  it('identity-less bare slot ALONE ⇒ zero generic entries (pre-A2 parity)', async () => {
    discoverMock.mockResolvedValue([
      { id: 'canton', provider: recorder(), source: 'injected', name: 'Canton Wallet', identityResolved: false },
    ]);
    const wallets = await makeClient().listWallets({ includeExperimental: true });
    expect(wallets.map((w) => String(w.walletId))).toEqual(['console']); // only the registry console entry
  });

  it('a RESOLVED unknown injected entry still becomes a dynamic entry (unchanged)', async () => {
    discoverMock.mockResolvedValue([
      { id: 'resolvedwallet', provider: recorder(), source: 'injected', name: 'Resolved', identityResolved: true },
    ]);
    const ids = (await makeClient().listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(ids).toContain('browser:ext:resolvedwallet');
  });
});

describe('A2 per-click target isolation (the collision itself)', () => {
  it('two announcers + a foreign slot occupant: each click reaches ONLY its own wallet', async () => {
    const recA = recorder();
    const recB = recorder();
    const recOccupant = recorder(); // window.canton owner with a foreign id
    discoverMock.mockResolvedValue([
      { id: 'walletA', provider: recA, source: 'injected', name: 'Wallet A' },
      { id: 'walletB', provider: recB, source: 'injected', name: 'Wallet B' },
      { id: 'occupant', provider: recOccupant, source: 'injected', name: 'Occupant' },
    ]);
    const client = makeClient();
    await client.listWallets({ includeExperimental: true });

    // Click A → only A's channel is touched.
    await client.connect({ walletId: 'browser:ext:walletA' as never });
    expect(recA.calls).toContain('connect');
    expect(recB.calls).toEqual([]); // never woken
    expect(recOccupant.calls).toEqual([]); // slot owner untouched

    // Click B → only B's channel is touched.
    await client.disconnect();
    await client.connect({ walletId: 'browser:ext:walletB' as never });
    expect(recB.calls).toContain('connect');
    // A unchanged from its own connect; B's neighbours stayed silent on B's click.
    expect(recOccupant.calls).toEqual([]);
  });
});
