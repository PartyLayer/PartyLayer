// @vitest-environment jsdom
/**
 * REGRESSION SUITE: ConsoleAdapter + generic CIP-0103 discovery, safe in parallel.
 *
 * This is a PERMANENT, maintained suite. It locks in the safety property that a
 * future change can never silently reintroduce:
 *   - a duplicate "console" entry, or
 *   - the `browser:ext:canton` phantom (the post-A2 live incident).
 *
 * It asserts REAL source behavior, not mocks of it:
 *   - the dedup + phantom-drop in client.ts (aggregateAnnouncedWallets,
 *     client.ts:520-583): identityResolved===false entries are dropped, and a
 *     provider id that maps (via providerDetection) to a wallet whose adapter is
 *     already registered adds NO second entry (`adapters.has -> continue`);
 *   - discovery.ts: window.canton is a bare CIP-0103 slot scanned by
 *     discoverInjectedProviders(); its stable id resolves via a status() probe
 *     (resolveInjectedKey, discovery.ts:451-469);
 *   - detection.ts: providerDetection maps provider.id -> the console entry
 *     (findMatchingWallet, detection.ts:127-148).
 *
 * NO production code is exercised in a modified form: getBuiltinAdapters,
 * ConsoleAdapter, @partylayer/adapter-console, and the registry are untouched.
 * CONSOLE_ID is anchored to the shipping registry so a drift fails loudly.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ConsoleAdapter's barrel pulls @console-wallet/dapp-sdk (SVG imports explode
// under Node). A hoisted vi.fn() mock stands in; defaults are set in beforeEach.
// This does NOT alter ConsoleAdapter logic — it only feeds its SDK calls.
const mockConsoleWallet = vi.hoisted(() => ({
  checkExtensionAvailability: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(),
  getPrimaryAccount: vi.fn(),
  getActiveNetwork: vi.fn(),
  status: vi.fn(),
  signMessage: vi.fn(),
  submitCommands: vi.fn(),
  ledgerApi: vi.fn(),
  onConnectionStatusChanged: vi.fn(),
  onTxStatusChanged: vi.fn(),
}));
vi.mock('@console-wallet/dapp-sdk', () => ({ consoleWallet: mockConsoleWallet }));

import {
  discoverInjectedProviders,
  isCIP0103Provider,
} from '@partylayer/provider';
import {
  findMatchingWalletInfo,
  toWalletId,
  type AdapterContext,
  type CIP0103Provider,
  type Session,
  type WalletInfo,
} from '@partylayer/core';
import { ConsoleAdapter } from '@partylayer/adapter-console';
import { createPartyLayer } from './client';

// Console's VERIFIED provider id == the registry providerDetection matcher value.
// Anchored to the shipping registry by the "registry anchor" test below.
const CONSOLE_ID = 'lpnfhpbpmlobjlgkdmnjieeihjmihhjd';

/**
 * A Console-shaped bare CIP-0103 provider: request/on/emit/removeListener (so
 * isCIP0103Provider === true) but NO top-level `id` — its identity is only
 * reachable via status().provider.id, matching discovery.ts:443-449.
 */
function consoleShapedProvider() {
  const calls: string[] = [];
  const p = {
    calls,
    request: async ({ method }: { method: string }) => {
      calls.push(method);
      if (method === 'status')
        return { provider: { id: CONSOLE_ID }, network: { networkId: 'canton:da-devnet' } };
      if (method === 'getPrimaryAccount')
        return { partyId: 'party::console-user', publicKey: 'pk', networkId: 'canton:da-devnet' };
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
  return p as unknown as CIP0103Provider & { calls: string[] };
}

/** Registry WalletInfo for Console, carrying the providerDetection bridge target. */
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

/** The shipping console registry entry shape (NO transport: 'announce'). */
const CONSOLE_REGISTRY_ENTRY = { id: 'console', adapter: { type: '@partylayer/adapter-console' } };

function setWindowCanton(p: unknown): void {
  (window as unknown as Record<string, unknown>).canton = p;
}

/** Create a client whose registry returns the console entry (with detection). */
function makeClientWithRegistry(
  adapters: ConstructorParameters<typeof createPartyLayer>[0]['adapters'],
) {
  const client = createPartyLayer({
    network: 'devnet',
    app: { name: 'console-regression', origin: 'https://test.example.com' },
    discovery: { announceTimeoutMs: 0 },
    adapters,
  });
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([consoleWalletInfo()]);
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
  vi.spyOn(client.registryClient, 'getWalletEntry').mockResolvedValue(CONSOLE_REGISTRY_ENTRY as never);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Neutral defaults for discovery tests (ConsoleAdapter registered but uninstalled).
  mockConsoleWallet.checkExtensionAvailability.mockResolvedValue({ status: 'not-installed' });
  mockConsoleWallet.isConnected.mockResolvedValue({ isConnected: false });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).canton;
  vi.restoreAllMocks();
});

// ── Point 4: anchor CONSOLE_ID to the shipping registry (fail loudly on drift) ─
describe('registry anchor', () => {
  it('the stable registry console entry detects on provider.id == CONSOLE_ID', () => {
    const rel = 'registry/v1/stable/registry.json';
    const candidates = [
      resolve(process.cwd(), rel),
      resolve(process.cwd(), '../..', rel),
      resolve(process.cwd(), '../../..', rel),
    ];
    const path = candidates.find((p) => existsSync(p));
    expect(path, 'registry.json not found from cwd').toBeDefined();
    const registry = JSON.parse(readFileSync(path!, 'utf-8')) as {
      wallets: Array<{ id: string; providerDetection?: { matchers: Array<{ field: string; values: string[] }> } }>;
    };
    const console = registry.wallets.find((w) => w.id === 'console');
    expect(console?.providerDetection?.matchers?.[0]).toMatchObject({
      field: 'provider.id',
      values: [CONSOLE_ID],
    });
  });
});

// ── Supporting: injected scan + providerDetection bridge (underpin Point 1) ──
describe('discovery + bridge primitives', () => {
  it('discoverInjectedProviders() sees the bare window.canton CIP-0103 slot', () => {
    const p = consoleShapedProvider();
    setWindowCanton(p);
    expect(isCIP0103Provider(window.canton)).toBe(true);
    expect((window.canton as unknown as { id?: unknown }).id).toBeUndefined(); // identity-less
    const canton = discoverInjectedProviders().find((d) => d.id === 'canton');
    expect(canton).toBeDefined();
    expect(canton!.source).toBe('injected');
  });

  it('providerDetection bridges provider.id -> the console entry (and only that id)', () => {
    expect(
      String(findMatchingWalletInfo({ provider: { id: CONSOLE_ID } } as never, [consoleWalletInfo()])!.walletId),
    ).toBe('console');
    expect(findMatchingWalletInfo({ provider: { id: 'foreign-id' } } as never, [consoleWalletInfo()])).toBeUndefined();
  });
});

// ── Point 1 + Point 3: dedup -> exactly ONE console with ConsoleAdapter present ─
describe('dedup: ConsoleAdapter + generic discovery in parallel', () => {
  it('Point 1: real ConsoleAdapter registered + injected provider => exactly ONE "console", zero phantom/dup', async () => {
    setWindowCanton(consoleShapedProvider()); // status() resolves provider.id == CONSOLE_ID
    const client = makeClientWithRegistry([new ConsoleAdapter()]);

    const ids = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));

    expect(ids.filter((id) => id === 'console')).toHaveLength(1); // THE safety property
    expect(ids).not.toContain(`browser:ext:${CONSOLE_ID}`); // no dynamic dup
    expect(ids).not.toContain('browser:ext:canton'); // no phantom (client.ts:520 drop)
    // Dedup branch (client.ts:531 `adapters.has -> continue`): the bespoke adapter still serves it.
    expect(client.getAdapter('console')).toBeInstanceOf(ConsoleAdapter);

    client.destroy();
  });

  it('Point 3: the generic-discovered Console adds NO second entry while ConsoleAdapter is registered', async () => {
    // With the injected Console provider present, the only "console" comes from
    // the base list; the generic bridge contributes nothing (adapters.has).
    setWindowCanton(consoleShapedProvider());
    const withGeneric = (await makeClientWithRegistry([new ConsoleAdapter()]).listWallets({ includeExperimental: true }))
      .map((w) => String(w.walletId))
      .filter((id) => id.startsWith('console') || id.startsWith('browser:ext:'));
    expect(withGeneric).toEqual(['console']); // one console, no browser:ext:* siblings
  });
});

// ── Point 2: identityResolved===false drop (no phantom before status resolves) ─
describe('phantom guard: identity-less bare slot is never listed', () => {
  it('a window.canton slot whose status() never yields an id synthesizes NO picker entry', async () => {
    // A bare slot that does NOT resolve an id: status() returns no provider.id,
    // so resolveInjectedKey falls back to the path id 'canton' (identityResolved=false),
    // which aggregateAnnouncedWallets drops (client.ts:520). Result: only the
    // registry console entry, never a browser:ext:canton phantom.
    const unresolvable = {
      request: async () => ({}), // status() yields nothing useful
      on() {
        return unresolvable;
      },
      emit() {
        return true;
      },
      removeListener() {
        return unresolvable;
      },
    };
    setWindowCanton(unresolvable);
    const client = makeClientWithRegistry([]); // no adapters: isolate the discovery path

    const ids = (await client.listWallets({ includeExperimental: true })).map((w) => String(w.walletId));
    expect(ids).not.toContain('browser:ext:canton'); // the phantom never appears
    expect(ids.filter((id) => id === 'console')).toHaveLength(1); // only the registry entry

    client.destroy();
  });
});

// ── Point 5: ConsoleAdapter connect/signMessage/submitTransaction smoke ───────
describe('ConsoleAdapter behavior unchanged (smoke, no live extension)', () => {
  function makeCtx(): AdapterContext {
    const noop = () => {};
    return {
      appName: 'smoke',
      origin: 'https://test.example.com',
      network: 'devnet',
      logger: { debug: noop, info: noop, warn: noop, error: noop },
      registry: { getWallet: vi.fn() },
      crypto: { encrypt: vi.fn(), decrypt: vi.fn(), generateKey: vi.fn() },
      storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
      timeout: (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
    } as unknown as AdapterContext;
  }

  it('connect -> session+capabilities; signMessage -> SignedMessage; submitTransaction -> TxReceipt', async () => {
    // Remote mode: no extension/window dependency. Simulate a connected wallet.
    mockConsoleWallet.connect.mockResolvedValue({ isConnected: true });
    mockConsoleWallet.getPrimaryAccount.mockResolvedValue({ partyId: 'party::console-user' });
    mockConsoleWallet.getActiveNetwork.mockResolvedValue({ id: 'devnet' });
    mockConsoleWallet.status.mockResolvedValue({ provider: { id: CONSOLE_ID, providerType: 'extension' } });
    mockConsoleWallet.signMessage.mockResolvedValue('0xsignature');
    mockConsoleWallet.submitCommands.mockResolvedValue({ signature: '0xupdateid' });

    const adapter = new ConsoleAdapter({ target: 'remote' });
    expect(String(adapter.walletId)).toBe('console');
    expect(adapter.getCapabilities()).toEqual(
      expect.arrayContaining(['connect', 'signMessage', 'submitTransaction']),
    );

    const ctx = makeCtx();

    // connect
    const res = await adapter.connect(ctx);
    expect(String(res.partyId)).toBe('party::console-user');
    expect(String(res.session.walletId)).toBe('console');
    expect(mockConsoleWallet.connect).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'remote', name: 'smoke' }),
    );

    const session = { ...res.session, partyId: res.partyId } as unknown as Session;

    // signMessage: SDK is called with the hex-encoded message; returns a SignedMessage.
    const signed = await adapter.signMessage(ctx, session, { message: 'hello' } as never);
    expect(String(signed.signature)).toBe('0xsignature');
    expect(signed.message).toBe('hello');
    expect(mockConsoleWallet.signMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.objectContaining({ hex: expect.stringMatching(/^0x/) }) }),
    );

    // submitTransaction: SDK submitCommands with waitForFinalization; returns a TxReceipt.
    const receipt = await adapter.submitTransaction(ctx, session, { signedTx: { commands: [] } } as never);
    expect(String(receipt.transactionHash)).toBe('0xupdateid');
    expect(typeof receipt.submittedAt).toBe('number');
    expect(mockConsoleWallet.submitCommands).toHaveBeenCalledWith(
      expect.objectContaining({ waitForFinalization: 5000 }),
    );
  });
});
