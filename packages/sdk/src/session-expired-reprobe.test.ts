/**
 * The fourth `session:expired` emit site: the restore re-probe inside
 * listWallets (client.ts:628).
 *
 * It is the only one of the four that could not be reached from the other test
 * file, because it needs a specific sequence rather than a specific input:
 *
 *   1. a session is restored while NO adapter is registered for its wallet, so
 *      restoreSession falls through to the as-is path and sets
 *      activeSessionNeedsProbe (client.ts:1553-1558);
 *   2. listWallets then finds an announced provider whose id maps to a registry
 *      entry with `adapter.transport: 'announce'`, and builds a
 *      GenericAnnounceAdapter for it on the spot;
 *   3. that adapter has a `restore` (only present when the entry sets
 *      `adapter.config.restore`), so the re-probe runs;
 *   4. the re-probe returns null, and the emit under test fires.
 *
 * Everything below exists to produce that sequence. The point was to find out
 * whether this site shares the null-dereference the getActiveSession site had,
 * by making it fire rather than by reading it.
 *
 * RESULT: it does not. It is GUARDED, by two separate things, and the second
 * one is worth knowing about because it changes what a bug here would look
 * like.
 *
 *   Guard 1, the local `active`. The session id is read from a binding captured
 *   before `this.activeSession = null`, so the emit never dereferences the
 *   field. Verified by mutation: swapping `active.sessionId` for
 *   `this.activeSession!.sessionId` makes this test fail. That is what makes
 *   "guarded" mean something here rather than being an observation about the
 *   shape of the code.
 *
 *   Guard 2, the surrounding try/catch (client.ts:629). The re-probe is wrapped
 *   so it can never break listWallets. Under the mutation above, the TypeError
 *   is SWALLOWED: the test fails with zero events emitted, not with a thrown
 *   error. So the same defect that crashed getActiveSession would be silent
 *   here, surfacing as a missing session:expired and a session left stale
 *   rather than as a crash.
 *
 * Which is the reason not to copy one site's pattern to another. In
 * getActiveSession the defect was loud and took down signMessage; here it would
 * have been quiet and left a stale session behind. Loud is easier to find.
 */

import { describe, it, expect, vi } from 'vitest';
import type { WalletAdapter, Session, PersistedSession, Storage, WalletInfo } from '@partylayer/core';
import { toWalletId, toPartyId } from '@partylayer/core';

// vi.mock factories are hoisted above module-level consts, so anything they
// reference has to be hoisted with them.
const { ANNOUNCE_ID, WALLET_ID, PARTY, announcedProvider } = vi.hoisted(() => {
  const ANNOUNCE_ID = 'browser:ext:announce-under-test';
  const WALLET_ID = 'announce-under-test';
  const PARTY = 'party::announce';
  /** The announced wallet's provider. `status` is the lever that picks the branch. */
  const announcedProvider = {
    request: async ({ method }: { method: string }) => {
      // An EXPLICIT disconnected signal is what makes GenericAnnounceAdapter's
      // restore() return null (announce-adapter.ts:380), which is the branch
      // that reaches the emit under test.
      if (method === 'status') return { isConnected: false };
      if (method === 'getPrimaryAccount') return { partyId: PARTY };
      return {};
    },
    on: () => {},
    removeListener: () => {},
    emit: () => {},
  };
  return { ANNOUNCE_ID, WALLET_ID, PARTY, announcedProvider };
});

vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

vi.mock('@partylayer/provider', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/provider')>('@partylayer/provider');
  return {
    ...actual,
    // One announced wallet, identity resolved so it is not skipped at :577.
    discoverProviders: async () => [
      {
        id: ANNOUNCE_ID,
        name: 'Announce Under Test',
        provider: announcedProvider,
        identityResolved: true,
      },
    ],
    createExtensionChannelProvider: () => announcedProvider,
    subscribeAnnouncedProviders: () => () => {},
  };
});

vi.mock('@partylayer/registry-client', async () => {
  const actual = await vi.importActual<typeof import('@partylayer/registry-client')>(
    '@partylayer/registry-client',
  );
  const core = await vi.importActual<typeof import('@partylayer/core')>('@partylayer/core');

  // The registry entry that makes this an announce wallet WITH a restore probe.
  // Both matter: transport gates the branch at :596, config.restore is what puts
  // a `restore` method on the adapter at announce-adapter.ts:211.
  const entry = {
    id: WALLET_ID,
    name: 'Announce Under Test',
    supportedNetworks: ['devnet'],
    capabilities: { signMessage: true, signTransaction: false, submitTransaction: true, transactionStatus: false, switchNetwork: false, multiParty: false },
    adapter: { type: '@partylayer/adapter-announce-under-test', transport: 'announce', config: { restore: true } },
    installation: { windowProperty: 'cantonUnderTest' },
    sdkVersion: '>=0.1.0',
  };

  const walletInfo: WalletInfo = {
    walletId: core.toWalletId(WALLET_ID),
    name: 'Announce Under Test',
    website: '',
    icons: {},
    capabilities: ['connect', 'disconnect', 'restore'],
    adapter: { packageName: entry.adapter.type, versionRange: '*' },
    docs: [],
    networks: ['devnet'],
    channel: 'stable',
    // Identity bridge: findMatchingWalletInfo maps the announced id to this entry.
    providerDetection: {
      transport: 'window.canton',
      matchers: [{ field: 'provider.id', match: 'exact', values: [ANNOUNCE_ID] }],
    },
  } as unknown as WalletInfo;

  class AnnounceRegistryClient {
    async getWallets() { return [walletInfo]; }
    async listWallets() { return [walletInfo]; }
    async getWalletEntry(id: string) {
      if (id === WALLET_ID) return entry;
      throw new core.WalletNotFoundError(id);
    }
    async getRegistry() { return { wallets: [entry], metadata: {} }; }
    async refreshRegistry() { return { wallets: [entry], metadata: {} }; }
    getStatus() { return { state: 'offline', lastFetchAt: null, lastError: null }; }
    onStatusChange() { return () => {}; }
  }
  return { ...actual, RegistryClient: AnnounceRegistryClient };
});

import { createPartyLayer } from './index';

// announceEnabled returns false when `window` is undefined (client.ts:478), so
// in a Node runner the entire announce path, and the re-probe inside it, is
// unreachable. A bare object is enough: discoverProviders and
// createExtensionChannelProvider are both mocked above, so nothing else on the
// announce path touches window.
vi.stubGlobal('window', {});

/**
 * Poll for a condition with a bound, rather than sleeping a fixed tick.
 *
 * The constructor's restoreSession() is fire-and-forget (client.ts:283), so the
 * test does not own the promise it is waiting on. This originally waited one
 * macrotask, which was enough on a dev machine and not on CI: the session had
 * not been revived yet and the precondition failed there and only there.
 *
 * Deliberately does NOT assert on timeout. It returns either way, so the
 * caller's own assertion runs and reports what was actually observed, rather
 * than a generic "timed out" that hides the state.
 */
async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
}

function makeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    async get(k: string) { return data.get(k) ?? null; },
    async set(k: string, v: string) { data.set(k, v); },
    async remove(k: string) { data.delete(k); },
    async clear() { data.clear(); },
  } as Storage;
}

/** Only used to seed a persisted session for a wallet the second client cannot serve. */
class SeedAdapter implements WalletAdapter {
  readonly walletId = toWalletId(WALLET_ID);
  readonly name = 'Seed';
  getCapabilities() {
    return ['connect', 'disconnect'] as ReturnType<WalletAdapter['getCapabilities']>;
  }
  async detectInstalled() { return { installed: true }; }
  async connect() {
    return {
      partyId: toPartyId(PARTY),
      session: {
        walletId: this.walletId,
        network: 'devnet' as const,
        createdAt: Date.now(),
        metadata: {},
      },
      capabilities: ['connect'] as ReturnType<WalletAdapter['getCapabilities']>,
    };
  }
  async disconnect() {}
  // Deliberately NO restore: forces the as-is revive that sets the probe flag.
  restore?: undefined;
}

describe('session:expired from the listWallets re-probe', () => {
  it('emits with the pre-clear session id and does not throw', async () => {
    const storage = makeStorage();

    // Seed a persisted session for WALLET_ID.
    const seed = createPartyLayer({
      network: 'devnet',
      app: { name: 'reprobe', origin: 'https://reprobe.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [new SeedAdapter()],
      storage,
    });
    await seed.connect({ walletId: toWalletId(WALLET_ID) });
    await seed.destroy();

    // Second client registers NO adapter for that wallet, so restoreSession
    // revives the session as-is and sets activeSessionNeedsProbe.
    const client = createPartyLayer({
      network: 'devnet',
      app: { name: 'reprobe', origin: 'https://reprobe.example' },
      registryUrl: 'https://unused.invalid',
      adapters: [],
      storage,
    });

    const internals = client as unknown as {
      activeSession: Session | null;
      activeSessionNeedsProbe: boolean;
    };

    // Wait for the constructor's fire-and-forget restoreSession to revive the
    // session as-is. Bounded poll, not a fixed sleep: a bigger sleep is the same
    // bug with a better hit rate.
    await waitFor(() => internals.activeSession !== null);
    // Preconditions for the branch. Asserted, not assumed: if the as-is revive
    // stops happening, this test would otherwise silently stop covering the site.
    expect(internals.activeSession).not.toBeNull();
    expect(internals.activeSessionNeedsProbe).toBe(true);
    const idBefore = internals.activeSession?.sessionId;

    const seen: Array<{ sessionId: unknown }> = [];
    client.on('session:expired', (e) => seen.push(e as { sessionId: unknown }));

    // The re-probe runs here, inside listWallets.
    await expect(client.listWallets()).resolves.toBeDefined();

    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[0]?.sessionId).toBe(idBefore);
    expect(internals.activeSession).toBeNull();

    await client.destroy();
  });
});
