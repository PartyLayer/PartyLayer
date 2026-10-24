// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CIP0103Provider, OfficialProviderAdapter } from '@partylayer/core';
import { NativeConnectionOwner } from './native-owner';

const owners: NativeConnectionOwner[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => {
  owners.splice(0).forEach((owner) => owner.destroy());
  localStorage.clear();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  let account = { partyId: 'party::alice', networkId: 'canton:da-devnet', publicKey: 'actual-key' };
  let status = { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } };
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const request = vi.fn(async ({ method }: { method: string }): Promise<unknown> => {
    if (method === 'connect') return { isConnected: true };
    if (method === 'getPrimaryAccount') return account;
    if (method === 'status') return status;
    if (method === 'ledgerApi') return { actualLedgerResponse: true };
    return undefined;
  });
  const provider: CIP0103Provider = {
    request: request as CIP0103Provider['request'],
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return provider;
    },
    emit: (event, ...args) => {
      listeners.get(event)?.forEach((listener) => listener(args[0]));
      return true;
    },
    removeListener: (event, listener) => {
      listeners.get(event)?.delete(listener);
      return provider;
    },
  };
  const source: OfficialProviderAdapter = {
    providerId: 'native-fixture',
    name: 'Native fixture',
    type: 'browser',
    provider: vi.fn(() => provider),
    detect: vi.fn(async () => true),
    restore: vi.fn(async () => provider),
    teardown: vi.fn(),
  };
  const changed = vi.fn();
  const owner = new NativeConnectionOwner(changed);
  owners.push(owner);
  return {
    owner,
    source,
    provider,
    request,
    changed,
    listeners,
    setAccount: (value: typeof account) => {
      account = value;
    },
    setStatus: (value: typeof status) => {
      status = value;
    },
  };
}

describe('native owner with the installed official DiscoveryClient', () => {
  it('does not acquire a provider or open a popup during preparation; connect starts synchronously', async () => {
    const { owner, source, request } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    expect(source.provider).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    const connection = owner.connect('native-fixture');
    expect(request).toHaveBeenCalledWith({ method: 'connect' });
    expect(await connection).toMatchObject({
      account: { partyId: 'party::alice', publicKey: 'actual-key' },
    });
    expect(owner.getSession()?.id).toBe('native-fixture');
    expect(
      await owner
        .getProvider()
        .request({ method: 'ledgerApi', params: { resource: '/v2/version' } })
    ).toEqual({ actualLedgerResponse: true });
  });

  it.each([false, { isConnected: false }])(
    'rejects a negative handshake before the official client commits: %j',
    async (result) => {
      const { owner, source, request } = fixture();
      await owner.prepare('native-fixture', source, 'devnet');
      request.mockResolvedValueOnce(result);
      await expect(owner.connect('native-fixture')).rejects.toThrow(/did not establish/);
      expect(owner.getSession()).toBeNull();
      expect(source.teardown).toHaveBeenCalledTimes(1);
    }
  );

  it('refuses an empty primary account and a contradictory disconnected status', async () => {
    const { owner, source, setAccount, setStatus } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    setAccount({ partyId: ' ', networkId: 'canton:da-devnet', publicKey: '' });
    await expect(owner.connect('native-fixture')).rejects.toThrow(/primary party/);
    await owner.prepare('native-fixture', source, 'devnet');
    setAccount({ partyId: 'party::alice', networkId: 'canton:da-devnet', publicKey: 'actual-key' });
    setStatus({ connection: { isConnected: false }, network: { networkId: 'canton:da-devnet' } });
    await expect(owner.connect('native-fixture')).rejects.toThrow(/no longer active/);
  });

  it('rejects duplicate operations without interrupting the pending approval', async () => {
    const { owner, source, request } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    const approval = deferred<unknown>();
    request.mockReturnValueOnce(approval.promise);
    const connection = owner.connect('native-fixture');
    expect(() => owner.connect('native-fixture')).toThrow(/already in progress/);
    approval.resolve({ isConnected: true });
    await connection;
    expect(owner.getSession()?.identity.account.partyId).toBe('party::alice');
  });

  it('cancels an unresponsive vendor, then allows reconnection; a late approval cannot replace it', async () => {
    const { owner, source, request, setAccount } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    const approval = deferred<unknown>();
    request.mockReturnValueOnce(approval.promise);
    const signal = new AbortController();
    const connection = owner.connect('native-fixture', signal.signal);
    signal.abort();
    await expect(connection).rejects.toThrow(/no longer active/);
    expect(owner.getSession()).toBeNull();
    await owner.prepare('native-fixture', source, 'devnet');
    setAccount({ partyId: 'party::bob', networkId: 'canton:da-devnet', publicKey: 'bob-key' });
    await owner.connect('native-fixture');
    approval.resolve({ isConnected: true });
    await Promise.resolve();
    expect(owner.getSession()?.identity.account.partyId).toBe('party::bob');
  });

  it('disconnect cancels a pending approval without waiting for the vendor to answer', async () => {
    const { owner, source, request } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    request.mockReturnValueOnce(new Promise(() => {}));
    const connection = owner.connect('native-fixture');
    const rejected = expect(connection).rejects.toThrow(/no longer active/);
    await owner.disconnect();
    await rejected;
    expect(owner.getSession()).toBeNull();
    expect(owner.busy).toBe(false);
  });

  it('bounds an unresponsive disconnect and ignores its late reply after reconnection', async () => {
    const { owner, source, request } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    await owner.connect('native-fixture');
    const reply = deferred<unknown>();
    request.mockReturnValueOnce(reply.promise);
    vi.useFakeTimers();
    try {
      let settled = false;
      let failure: unknown;
      const closing = owner.disconnect().catch((error: unknown) => {
        failure = error;
      }).finally(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(10_001);
      expect(settled).toBe(true);
      await closing;
      expect(failure).toBeInstanceOf(Error);
      expect(request).toHaveBeenCalledWith({ method: 'disconnect' });
      expect(owner.busy).toBe(false);
      expect(owner.getSession()).toBeNull();
      expect(source.teardown).toHaveBeenCalledTimes(1);
      await owner.prepare('native-fixture', source, 'devnet');
      await owner.connect('native-fixture');
      const hint = { ...localStorage };
      expect(Object.keys(hint).length).toBeGreaterThan(0);
      reply.resolve(undefined);
      await vi.advanceTimersByTimeAsync(0);
      expect(owner.getSession()?.identity.account.partyId).toBe('party::alice');
      expect({ ...localStorage }).toEqual(hint);
      expect(source.teardown).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restores only through the official persisted provider hint and validates the live identity', async () => {
    const { owner, source, request } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    await owner.connect('native-fixture');
    owner.destroy();
    const restored = new NativeConnectionOwner();
    owners.push(restored);
    await restored.prepare('native-fixture', source, 'devnet');
    request.mockClear();
    expect(
      await restored.restore({ id: 'native-fixture', partyId: 'party::alice', network: 'devnet' })
    ).toMatchObject({ id: 'native-fixture', identity: { account: { partyId: 'party::alice' } } });
    expect(request.mock.calls.map(([args]) => args.method)).toEqual([
      'getPrimaryAccount',
      'status',
    ]);
    await restored.disconnect();
    expect(restored.getSession()).toBeNull();
  });

  it.each(['party', 'network'] as const)(
    'does not restore a changed %s behind an old application identity',
    async (field) => {
      const { owner, source, setAccount, setStatus } = fixture();
      await owner.prepare('native-fixture', source, 'devnet');
      await owner.connect('native-fixture');
      owner.destroy();
      if (field === 'party')
        setAccount({
          partyId: 'party::other',
          networkId: 'canton:da-devnet',
          publicKey: 'other-key',
        });
      else
        setStatus({
          connection: { isConnected: true },
          network: { networkId: 'canton:da-mainnet' },
        });
      const restored = new NativeConnectionOwner();
      owners.push(restored);
      await restored.prepare('native-fixture', source, 'devnet');
      expect(
        await restored.restore({ id: 'native-fixture', partyId: 'party::alice', network: 'devnet' })
      ).toBeNull();
      expect(restored.getSession()).toBeNull();
    }
  );

  it('publishes current account/network events and removes subscriptions on destroy without wallet logout', async () => {
    const { owner, source, provider, changed, listeners, request, setAccount } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    await owner.connect('native-fixture');
    setAccount({ partyId: 'party::bob', networkId: 'canton:da-devnet', publicKey: 'bob-key' });
    provider.emit('accountsChanged', [{ partyId: 'party::bob' }]);
    await vi.waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        'native-fixture',
        expect.objectContaining({
          account: expect.objectContaining({ partyId: 'party::bob' }),
        })
      )
    );
    request.mockClear();
    owner.destroy();
    expect([...listeners.values()].reduce((sum, set) => sum + set.size, 0)).toBe(0);
    expect(request).not.toHaveBeenCalledWith({ method: 'disconnect' });
    expect(owner.getSession()).toBeNull();
    provider.emit('accountsChanged', [{ partyId: 'party::late' }]);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('invalidates a wallet-side disconnect instead of keeping a cached connected party', async () => {
    const { owner, source, provider, changed } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    await owner.connect('native-fixture');
    provider.emit('statusChanged', { connection: { isConnected: false } });
    expect(owner.getSession()).toBeNull();
    expect(changed).toHaveBeenCalledWith('native-fixture', null);
  });

  it('blocks signing while an account-change probe is pending and rejects a retired provider reference', async () => {
    const { owner, source, request, provider } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    await owner.connect('native-fixture');
    const heldProvider = owner.getProvider();
    const account = deferred<unknown>();
    request.mockReturnValueOnce(account.promise);
    provider.emit('accountsChanged', [{ partyId: 'party::bob' }]);
    await expect(
      heldProvider.request({ method: 'signMessage', params: { message: 'test' } })
    ).rejects.toThrow(/being refreshed/);
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'signMessage' }));
    account.resolve({ partyId: 'party::bob', networkId: 'canton:da-devnet' });
    await vi.waitFor(() => expect(owner.getSession()?.identity.account.partyId).toBe('party::bob'));
    await owner.disconnect();
    await expect(heldProvider.request({ method: 'signMessage' })).rejects.toThrow(
      /no longer active/
    );
  });

  it('bounds an unresponsive silent restore without opening another connect request', async () => {
    const { owner, source, request } = fixture();
    await owner.prepare('native-fixture', source, 'devnet');
    await owner.connect('native-fixture');
    owner.destroy();
    source.restore = vi.fn(() => new Promise(() => {}));
    const restored = new NativeConnectionOwner();
    owners.push(restored);
    await restored.prepare('native-fixture', source, 'devnet');
    request.mockClear();
    vi.useFakeTimers();
    try {
      const restore = restored.restore();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await restore).toBeNull();
      expect(restored.busy).toBe(false);
      expect(request).not.toHaveBeenCalledWith({ method: 'connect' });
    } finally {
      vi.useRealTimers();
    }
  });
});
