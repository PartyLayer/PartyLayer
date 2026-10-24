// @vitest-environment jsdom
/** Native restoration requires a live official owner, never a cached party alone. */
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
  type CapabilityKey,
  type StorageAdapter,
  type WalletAdapter,
  type WalletInfo,
} from '@partylayer/core';
import { createPartyLayer } from './client';

const ORIGIN = 'https://e2e.example.com';
const PARTY = 'party::send-1';
const SEND_ANNOUNCE_ID = 'sendext';

// ── Fake-wallet postMessage responder (drives the real channel provider) ─────
type RespHandlers = Record<string, unknown | { __error: { code: number; message: string } }>;
function installResponder(handlers: RespHandlers) {
  const onReq = (event: MessageEvent) => {
    const d = event.data as { type?: string; request?: { id: string; method: string } } | undefined;
    if (!d || d.type !== 'SPLICE_WALLET_REQUEST' || !d.request) return;
    const { id, method } = d.request;
    const h = handlers[method];
    const response = h && typeof h === 'object' && '__error' in h
      ? { jsonrpc: '2.0', id, error: (h as { __error: unknown }).__error }
      : { jsonrpc: '2.0', id, result: h ?? null };
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'SPLICE_WALLET_RESPONSE', response }, origin: window.location.origin, source: window }));
  };
  window.addEventListener('message', onReq as EventListener);
  return () => window.removeEventListener('message', onReq as EventListener);
}

function announce(id: string) {
  window.dispatchEvent(new CustomEvent('canton:announceProvider', { detail: { providerId: id, name: 'Send', target: id } }));
}

// In-memory shared storage so clientA's persisted session survives to clientB.
function memStorage(): StorageAdapter {
  const m = new Map<string, string>();
  return {
    async get(k) { return m.get(k) ?? null; },
    async set(k, v) { m.set(k, v); },
    async remove(k) { m.delete(k); },
    async clear() { m.clear(); },
  };
}

const sendWalletInfo = (): WalletInfo => ({
  walletId: toWalletId('send'), name: 'Send', website: '', icons: {},
  capabilities: ['connect', 'signMessage', 'submitTransaction'],
  adapter: { packageName: 'x', versionRange: '*' }, docs: [], networks: ['canton:mainnet'], channel: 'stable',
  providerDetection: { matchers: [{ field: 'provider.id', match: 'exact', values: [SEND_ANNOUNCE_ID] }] },
} as unknown as WalletInfo);

const ANNOUNCE_ENTRY = {
  id: 'send',
  adapter: { transport: 'announce', config: { metadata: true, restore: true, events: true } },
  capabilities: { events: true },
};

function spyRegistry(client: ReturnType<typeof createPartyLayer>, announceEntry: boolean) {
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([sendWalletInfo()]);
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ wallets: [] } as never);
  vi.spyOn(client.registryClient, 'getWalletEntry').mockImplementation(async (id: string) => {
    if (id === 'send' && announceEntry) return ANNOUNCE_ENTRY as never;
    throw new WalletNotFoundError(id);
  });
}

/** Bespoke-style adapter just to SEED a persisted session into shared storage. */
class TempSendAdapter implements WalletAdapter {
  readonly walletId = toWalletId('send');
  readonly name = 'Send';
  getCapabilities(): CapabilityKey[] { return ['connect', 'restore', 'signMessage', 'submitTransaction']; }
  async detectInstalled() { return { installed: true }; }
  async connect(): Promise<AdapterConnectResult> {
    return { partyId: toPartyId(PARTY), session: { walletId: this.walletId, partyId: toPartyId(PARTY), network: 'canton:mainnet' as never, metadata: { seeded: 'yes' } }, capabilities: this.getCapabilities() };
  }
  async disconnect() {}
}

async function seedAsIsSession(storage: StorageAdapter) {
  const a = createPartyLayer({ network: 'canton:mainnet', app: { name: 'seed', origin: ORIGIN }, adapters: [new TempSendAdapter()], storage });
  spyRegistry(a, false);
  await a.connect({ walletId: toWalletId('send') });
  a.destroy();
}

function makeClientB(storage: StorageAdapter) {
  const c = createPartyLayer({ network: 'canton:mainnet', app: { name: 'clientB', origin: ORIGIN }, adapters: [], discovery: { announceTimeoutMs: 0 }, storage });
  spyRegistry(c, true);
  return c;
}

const STATUS_OK = { isConnected: true, kernel: { id: 'k-live' }, network: { networkId: 'canton:mainnet', ledgerApi: { baseUrl: 'https://api.example' } } };
const ACCOUNT = { primary: true, partyId: PARTY, status: 'allocated', hint: 'h', publicKey: 'PK', namespace: 'NS', networkId: 'canton:mainnet', signingProviderId: 'webauthn-prf' };

describe('native announced-wallet cache migration', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('discards a legacy cached native identity until the user explicitly reconnects', async () => {
    const storage = memStorage();
    await seedAsIsSession(storage);
    const off = installResponder({ status: STATUS_OK, getPrimaryAccount: ACCOUNT });
    const client = makeClientB(storage);
    const expired = vi.fn(); client.on('session:expired', expired);
    announce(SEND_ANNOUNCE_ID);
    expect(await client.getActiveSession()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(await storage.get('active_session')).toBeNull();
    off(); client.destroy();
  });

  it('restores an announced wallet through the official owner after a real native connection', async () => {
    const storage = memStorage();
    const off = installResponder({ connect: { isConnected: true }, status: STATUS_OK, getPrimaryAccount: ACCOUNT });
    const first = makeClientB(storage);
    announce(SEND_ANNOUNCE_ID);
    await first.listWallets({ includeExperimental: true });
    const original = await first.connect({ walletId: toWalletId('send') });
    first.destroy();
    const restored = makeClientB(storage);
    const connected = vi.fn(); restored.on('session:connected', connected);
    announce(SEND_ANNOUNCE_ID);
    const session = await restored.getActiveSession();
    expect(session?.partyId).toBe(PARTY);
    expect(session?.sessionId).toBe(original.sessionId);
    expect(connected).toHaveBeenCalledTimes(1);
    await restored.listWallets({ includeExperimental: true });
    expect(connected).toHaveBeenCalledTimes(1);
    off(); restored.destroy();
  });

  it('(d) no active session → adapter creation does NOT re-probe (guard no-op)', async () => {
    const storage = memStorage(); // empty: nothing persisted
    const off = installResponder({ status: STATUS_OK, getPrimaryAccount: ACCOUNT });
    const client = makeClientB(storage);
    expect(await client.getActiveSession()).toBeNull();

    const connected = vi.fn(); const expired = vi.fn();
    client.on('session:connected', connected); client.on('session:expired', expired);
    announce(SEND_ANNOUNCE_ID);
    await new Promise((r) => setTimeout(r, 50));
    await client.listWallets({ includeExperimental: true });

    expect(connected).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
    off(); client.destroy();
  });

  it('never leaves a native cached identity connected when the live account probe fails', async () => {
    const storage = memStorage();
    const responses: RespHandlers = { connect: { isConnected: true }, status: STATUS_OK, getPrimaryAccount: ACCOUNT };
    const off = installResponder(responses);
    const first = makeClientB(storage);
    announce(SEND_ANNOUNCE_ID);
    await first.listWallets({ includeExperimental: true });
    await first.connect({ walletId: toWalletId('send') });
    first.destroy();
    responses.getPrimaryAccount = { __error: { code: -32603, message: 'Account unavailable' } };
    const client = makeClientB(storage);
    const expired = vi.fn(); client.on('session:expired', expired);
    announce(SEND_ANNOUNCE_ID);
    expect(await client.getActiveSession()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    const wallets = await client.listWallets({ includeExperimental: true });
    expect(wallets.some(wallet => String(wallet.walletId) === 'send')).toBe(true);
    off(); client.destroy();
  });

  it('(c) fresh-connect session (flag false) is NOT re-probed by a later listWallets', async () => {
    const storage = memStorage(); // empty — no as-is restore
    const off = installResponder({ connect: STATUS_OK, status: STATUS_OK, getPrimaryAccount: ACCOUNT });
    const client = makeClientB(storage);

    await client.listWallets({ includeExperimental: true }); // registers the configured 'send' adapter (no active session → no re-probe)
    announce(SEND_ANNOUNCE_ID);
    await new Promise((r) => setTimeout(r, 50));
    const session = await client.connect({ walletId: toWalletId('send') }); // FRESH connect → needsProbe=false
    expect(String(session.walletId)).toBe('send');

    const connected = vi.fn(); const expired = vi.fn();
    client.on('session:connected', connected); client.on('session:expired', expired);
    await client.listWallets({ includeExperimental: true }); // must NOT re-probe a fresh session
    expect(connected).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
    off(); client.destroy();
  });
});
