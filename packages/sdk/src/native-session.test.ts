// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CIP0103Provider,
  OfficialProviderAdapter,
  StorageAdapter,
  WalletAdapter,
} from '@partylayer/core';
import { WalletNotFoundError, toPartyId, toWalletId } from '@partylayer/core';
import { createPartyLayer } from './client';
import { GenericAnnounceAdapter } from './announce-adapter';

vi.mock('@console-wallet/dapp-sdk', () => ({ consoleWallet: {} }));
const clients: ReturnType<typeof createPartyLayer>[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => {
  clients.splice(0).forEach((client) => client.destroy());
  localStorage.clear();
});

function storage(): StorageAdapter {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
    clear: async () => values.clear(),
  };
}

function fixture() {
  let account = {
    primary: true,
    partyId: 'party::alice',
    publicKey: 'wallet-public-key',
    namespace: 'wallet-namespace',
    networkId: 'canton:da-devnet',
    signingProviderId: 'wallet-signer',
    hint: 'Alice',
    status: 'allocated',
  };
  let network = 'canton:da-devnet';
  const listeners = new Map<string, Set<(value: unknown) => void>>();
  const request = vi.fn(async ({ method }: { method: string }): Promise<unknown> => {
    if (method === 'connect') return { isConnected: true };
    if (method === 'status')
      return {
        provider: { id: 'native-test', providerType: 'browser' },
        connection: { isConnected: true },
        network: { networkId: network },
      };
    if (method === 'getPrimaryAccount') return account;
    if (method === 'getActiveNetwork') return { networkId: network };
    if (method === 'listAccounts')
      return [
        account,
        { ...account, primary: false, partyId: 'party::secondary', publicKey: 'secondary-key' },
      ];
    if (method === 'ledgerApi') return { version: 'real-ledger-shape' };
    if (method === 'signMessage') return { signature: 'test-signature', partyId: account.partyId };
    if (method === 'prepareExecuteAndWait')
      return {
        tx: {
          status: 'executed',
          commandId: 'cmd',
          payload: { updateId: 'update', completionOffset: 27 },
        },
      };
    return null;
  });
  const provider: CIP0103Provider = {
    request: request as CIP0103Provider['request'],
    on: (name, listener) => {
      const set = listeners.get(name) ?? new Set();
      set.add(listener);
      listeners.set(name, set);
      return provider;
    },
    removeListener: (name, listener) => {
      listeners.get(name)?.delete(listener);
      return provider;
    },
    emit: (name, value) => {
      listeners.get(name)?.forEach((listener) => listener(value));
      return true;
    },
  };
  const source: OfficialProviderAdapter = {
    providerId: 'native-test',
    name: 'Native Test',
    type: 'browser',
    detect: async () => true,
    provider: () => provider,
    restore: async () => provider,
    teardown: vi.fn(),
  };
  const sharedStorage = storage();
  function client(
    adapters: Parameters<typeof createPartyLayer>[0]['adapters'] = [source],
    enforcement?: 'strict'
  ) {
    const c = createPartyLayer({
      network: 'devnet',
      app: { name: 'Native acceptance fixture', origin: 'https://dapp.test' },
      adapters,
      storage: sharedStorage,
      discovery: { announce: false },
      networkEnforcement: enforcement,
      crypto: {
        encrypt: async (value) => value,
        decrypt: async (value) => value,
        generateKey: async () => 'fixture-key',
      },
    });
    vi.spyOn(c.registryClient, 'getWallets').mockResolvedValue([]);
    vi.spyOn(c.registryClient, 'getWalletEntry').mockRejectedValue(
      new WalletNotFoundError('fixture')
    );
    clients.push(c);
    return c;
  }
  return {
    client,
    provider,
    request,
    source,
    listeners,
    sharedStorage,
    getAccount: () => account,
    switchAccount: (partyId: string) => {
      account = { ...account, partyId };
    },
    switchNetwork: (value: string) => {
      network = value;
    },
  };
}

describe('public SDK native-owner integration', () => {
  it('does not attribute a bare signature to the old party when an eventless wallet changes its primary during approval', async () => {
    const f = fixture();
    const c = f.client();
    await c.connect({ walletId: toWalletId('native-test') });
    f.request.mockImplementationOnce(async ({ method }) => {
      expect(method).toBe('signMessage');
      f.switchAccount('party::changed-during-approval');
      return 'signature-from-the-new-party';
    });
    await expect(c.signMessage({ message: 'original message' })).rejects.toThrow(
      /identity changed/
    );
    expect((await c.getActiveSession())?.partyId).toBe('party::changed-during-approval');
  });

  it('returns one stable provider with actual native accounts and raw standard ledger request/response shapes', async () => {
    const f = fixture();
    const c = f.client();
    const provider = c.asProvider();
    expect(c.asProvider()).toBe(provider);
    const prepared = await c.prepareConnect({ walletId: toWalletId('native-test') });
    f.request.mockClear();
    const connection = prepared.connect();
    expect(f.request).toHaveBeenCalledWith({ method: 'connect' });
    await connection;
    expect(await provider.request({ method: 'getPrimaryAccount' })).toBe(f.getAccount());
    expect(await provider.request<unknown[]>({ method: 'listAccounts' })).toHaveLength(2);
    const params = {
      requestMethod: 'get',
      resource: '/v2/updates/{updateId}',
      path: { updateId: 'update' },
      query: { verbose: true },
      headers: { 'x-request-id': 'request' },
    };
    expect(await provider.request({ method: 'ledgerApi', params })).toEqual({
      version: 'real-ledger-shape',
    });
    expect(f.request).toHaveBeenCalledWith({ method: 'ledgerApi', params });
    await c.disconnect();
    expect(await c.getActiveSession()).toBeNull();
  });

  it('restores the official provider before exposing the persisted PartyLayer projection', async () => {
    const f = fixture();
    const first = f.client();
    await first.connect({ walletId: toWalletId('native-test') });
    first.destroy();
    f.request.mockClear();
    const second = f.client();
    expect((await second.getActiveSession())?.partyId).toBe('party::alice');
    expect(f.request).not.toHaveBeenCalledWith({ method: 'connect' });
    expect(await second.asProvider().request({ method: 'getPrimaryAccount' })).toBe(f.getAccount());
    expect((await second.signMessage({ message: 'test message' })).signature).toBe(
      'test-signature'
    );
  });

  it('rejects a changed party on reload instead of silently adopting it into the previous application session', async () => {
    const f = fixture();
    const first = f.client();
    await first.connect({ walletId: toWalletId('native-test') });
    first.destroy();
    f.switchAccount('party::other');
    const second = f.client();
    expect(await second.getActiveSession()).toBeNull();
    expect(await f.sharedStorage.get('active_session')).toBeNull();
  });

  it('updates SDK identity on native account events and forwards genuine transaction events', async () => {
    const f = fixture();
    const c = f.client();
    const provider = c.asProvider();
    const transactions = vi.fn();
    provider.on('txChanged', transactions);
    await c.connect({ walletId: toWalletId('native-test') });
    f.switchAccount('party::bob');
    f.provider.emit('accountsChanged', [{ ...f.getAccount() }]);
    await vi.waitFor(async () => expect((await c.getActiveSession())?.partyId).toBe('party::bob'));
    const event = {
      status: 'executed',
      commandId: 'wallet-command',
      payload: { updateId: 'ledger-update', completionOffset: 29 },
    };
    f.provider.emit('txChanged', event);
    expect(transactions).toHaveBeenCalledTimes(1);
    expect(transactions).toHaveBeenCalledWith(event);
    c.destroy();
    expect([...f.listeners.values()].reduce((sum, set) => sum + set.size, 0)).toBe(0);
  });

  it('blocks transactions after a live network change and releases the rejected strict connection', async () => {
    const f = fixture();
    const c = f.client();
    await c.connect({ walletId: toWalletId('native-test') });
    f.switchNetwork('canton:da-mainnet');
    f.provider.emit('statusChanged', { network: { networkId: 'canton:da-mainnet' } });
    await vi.waitFor(async () =>
      expect((await c.getActiveSession())?.network).toBe('canton:da-mainnet')
    );
    await expect(c.submitTransaction({ signedTx: { commands: [] } })).rejects.toThrow(/network/i);
    await expect(
      c.asProvider().request({ method: 'prepareExecute', params: { commands: [] } })
    ).rejects.toThrow(/network/i);
    await c.disconnect();
    const strict = f.client([f.source], 'strict');
    await expect(strict.connect({ walletId: toWalletId('native-test') })).rejects.toThrow(
      /network/i
    );
    expect(await strict.getActiveSession()).toBeNull();
  });

  it('treats a wallet-side disconnect as terminal for the SDK identity', async () => {
    const f = fixture();
    const c = f.client();
    const disconnected = vi.fn();
    c.on('session:disconnected', disconnected);
    const session = await c.connect({ walletId: toWalletId('native-test') });
    f.provider.emit('statusChanged', { connection: { isConnected: false } });
    expect(await c.getActiveSession()).toBeNull();
    expect(disconnected).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: session.sessionId })
    );
    expect(await f.sharedStorage.get('active_session')).toBeNull();
  });

  it('also clears a disconnected native status observed by an explicit read without a push event', async () => {
    const f = fixture();
    const c = f.client();
    const provider = c.asProvider();
    await c.connect({ walletId: toWalletId('native-test') });
    f.request.mockResolvedValueOnce({ connection: { isConnected: false } });
    expect(await provider.request({ method: 'status' })).toEqual({
      connection: { isConnected: false },
    });
    expect(await c.getActiveSession()).toBeNull();
  });

  it('keeps Console-style message encoding at the compatibility boundary while exposing actual native accounts', async () => {
    const f = fixture();
    const announced = new GenericAnnounceAdapter({
      announceId: 'test-extension',
      walletId: toWalletId('native-test'),
      provider: f.provider,
      config: { signMessageBase64: true, restore: true },
    });
    const c = f.client([announced]);
    await c.connect({ walletId: toWalletId('native-test') });
    expect(
      await c.asProvider().request({ method: 'signMessage', params: { message: 'hello' } })
    ).toBe('test-signature');
    expect(f.request).toHaveBeenCalledWith({
      method: 'signMessage',
      params: { message: 'aGVsbG8=' },
    });
    expect(await c.asProvider().request({ method: 'getPrimaryAccount' })).toBe(f.getAccount());
  });

  it('cleans up native transport when switching to an existing proprietary/custom adapter', async () => {
    const f = fixture();
    const legacy: WalletAdapter = {
      walletId: toWalletId('legacy'),
      name: 'Legacy',
      getCapabilities: () => ['connect'],
      detectInstalled: async () => ({ installed: true }),
      disconnect: async () => {},
      connect: async () => ({
        partyId: toPartyId('party::legacy'),
        session: { network: 'devnet' },
        capabilities: ['connect'],
      }),
    };
    const c = f.client([f.source, legacy]);
    await c.connect({ walletId: toWalletId('native-test') });
    await c.connect({ walletId: toWalletId('legacy') });
    expect((await c.getActiveSession())?.partyId).toBe('party::legacy');
    expect(f.source.teardown).toHaveBeenCalledTimes(1);
    expect([...f.listeners.values()].reduce((sum, set) => sum + set.size, 0)).toBe(0);
  });
});
