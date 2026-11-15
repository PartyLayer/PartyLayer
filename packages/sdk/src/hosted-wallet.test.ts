// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOneSwapProviderAdapter } from '@oneswap/wallet-cip0103-adapter';
import type { AdapterContext, CIP0103Provider, OfficialProviderAdapter, Session } from '@partylayer/core';
import { GenericDiscoveryAdapter } from './discovery-adapter';
import { createPartyLayer } from './client';
import { createProviderBridge } from '@partylayer/provider';
import { registryEntryToWalletInfo } from '@partylayer/registry-client';
import { createApplicationLedgerReader } from './application-ledger-reader';
vi.mock('@console-wallet/dapp-sdk', () => ({ consoleWallet: {} }));
import { createOneSwapHostedAdapter } from './hosted-wallet-profiles';

type WireRequest = { id: string | number; method: string; params?: Record<string, unknown> };
const party = { partyId: 'party::hosted', publicKey: 'wallet-public-key', network: 'devnet' };
const signature = { signature: 'approved-signature', publicKey: party.publicKey, partyId: party.partyId, encoding: 'utf8' };
const receipt = { transactionHash: 'ledger-update', updateId: 'ledger-update', submittedAt: '2026-11-15T00:00:00Z' };
const origin = 'https://wallet.example';
const adapters: OfficialProviderAdapter[] = [];
afterEach(() => { adapters.splice(0).forEach(adapter => adapter.teardown?.()); vi.restoreAllMocks(); vi.useRealTimers(); });
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

function popupFixture(automatic = true) {
  const requests: WireRequest[] = [];
  const windows: Window[] = [];
  const reply = (popup: Window, data: unknown, eventOrigin = origin, source: Window = popup) => {
    window.dispatchEvent(new MessageEvent('message', { origin: eventOrigin, source, data }));
  };
  let error: { code: number; message: string; data?: unknown } | undefined;
  let currentParty = party;
  const open = vi.spyOn(window, 'open').mockImplementation(() => {
    const popup = {
      closed: false, focus: vi.fn(), close: vi.fn(function(this: { closed: boolean }) { this.closed = true; }),
      postMessage: vi.fn((request: WireRequest, target: string) => {
        expect(target).toBe(origin);
        requests.push(request);
        if (!automatic) return;
        const result = request.method === 'canton_connect' ? { primaryAccount: currentParty, accounts: [currentParty], network: 'devnet' }
          : request.method === 'canton_signMessage' ? signature : request.method === 'canton_prepareSignExecute' ? receipt : undefined;
        queueMicrotask(() => reply(popup as unknown as Window, { id: request.id, ...(error ? { error } : { result }) }));
      }),
    };
    windows.push(popup as unknown as Window);
    return popup as unknown as Window;
  });
  return { requests, windows, open, reply, setParty(value: typeof party) { currentParty = value; }, setAutomatic(value: boolean) { automatic = value; }, setError(value: typeof error) { error = value; }, ready() { const popup = windows.at(-1)!; reply(popup, { type: 'oneswap:cip0103:ready' }); } };
}

const implementations = [
  ['independent hosted profile', createOneSwapHostedAdapter],
  ['published vendor 0.2.0 blackbox oracle', createOneSwapProviderAdapter],
] as const;

for (const [name, create] of implementations) describe(name, () => {
  function adapter(options = {}) {
    const instance = create({ walletUrl: origin, networkId: 'canton:da-devnet', timeoutMs: 5_000, ...options });
    adapters.push(instance as OfficialProviderAdapter);
    return instance;
  }

  it('preserves options, synchronous popup, public account/status/events, UTF8 signing, exactly-once execution and disconnect', async () => {
    const fixture = popupFixture();
    const source = adapter({ providerId: 'hosted-test', name: 'Hosted Test', icon: 'https://wallet.example/icon.svg', connectPath: '/approve', popupFeatures: 'width=600' });
    expect(source).toMatchObject({ providerId: 'hosted-test', name: 'Hosted Test', icon: 'https://wallet.example/icon.svg', type: 'remote' });
    expect(await source.detect()).toBe(true);
    expect(await source.restore!()).toBeNull();
    const provider = source.provider() as CIP0103Provider;
    expect(source.provider()).toBe(provider);
    const events: [string, unknown][] = [];
    for (const event of ['connected', 'accountsChanged', 'statusChanged', 'disconnected']) provider.on(event, value => events.push([event, value]));
    const connecting = provider.request({ method: 'connect', params: { appName: 'Protocol test', requestId: 'connect-1' } });
    expect(fixture.open).toHaveBeenCalledWith(`${origin}/approve`, name.startsWith('published') ? 'oneswap-cip0103' : expect.stringMatching(/^oneswap-cip0103-[0-9a-f]{32}$/), 'width=600');
    expect(fixture.requests).toEqual([]);
    fixture.ready();
    expect(await connecting).toEqual({ isConnected: true, isNetworkConnected: true });
    expect(fixture.requests[0]).toMatchObject({ method: 'canton_connect', params: { appName: 'Protocol test', requestId: 'connect-1', network: 'canton:da-devnet', origin: window.location.origin } });
    const account = { primary: true, partyId: party.partyId, publicKey: party.publicKey, status: 'allocated', hint: 'OneSwap V2 wallet', namespace: 'oneswap', networkId: 'canton:da-devnet', signingProviderId: 'oneswap-v2' };
    expect(await provider.request({ method: 'getPrimaryAccount' })).toEqual(account);
    expect(await provider.request({ method: 'listAccounts' })).toEqual([account]);
    expect(await provider.request({ method: 'getActiveNetwork' })).toEqual({ networkId: 'canton:da-devnet' });
    expect(await provider.request({ method: 'status' })).toEqual({ connection: { isConnected: true, isNetworkConnected: true }, provider: { id: 'hosted-test', version: '0.1.0', providerType: 'remote' }, network: { networkId: 'canton:da-devnet' } });
    expect(await provider.request({ method: 'isConnected' })).toBe(true);
    expect(await provider.request({ method: 'signMessage', params: { message: 'Hello Canton — 你好' } })).toEqual(signature);
    expect(fixture.requests.at(-1)?.params).toEqual({ message: 'Hello Canton — 你好' });
    const commands = [{ ExerciseCommand: { templateId: 'pkg:Module:Token', contractId: 'contract', choice: 'Transfer', choiceArgument: {} } }];
    expect(await provider.request({ method: 'prepareExecute', params: { commands } })).toEqual(receipt);
    expect(fixture.requests.filter(request => request.method === 'canton_prepareSignExecute')).toHaveLength(1);
    expect(fixture.requests.at(-1)?.params).toEqual({ commands });
    expect(fixture.open).toHaveBeenCalledTimes(1);
    expect(fixture.windows[0].focus).toHaveBeenCalled();
    await provider.request({ method: 'disconnect' });
    expect(fixture.requests.at(-1)?.method).toBe('canton_disconnect');
    expect(fixture.windows[0].close).toHaveBeenCalled();
    expect(await provider.request({ method: 'isConnected' })).toBe(false);
    expect(events.map(([event]) => event)).toEqual(['connected', 'statusChanged', 'accountsChanged', 'disconnected', 'statusChanged', 'accountsChanged']);
  });

  it('reopens a manually closed idle popup and does not reopen it merely to disconnect', async () => {
    const fixture = popupFixture(); const source = adapter(); const provider = source.provider() as CIP0103Provider;
    const connecting = provider.request({ method: 'connect' }); fixture.ready(); await connecting;
    fixture.windows[0].close();
    const signing = provider.request({ method: 'signMessage', params: { message: 'after close' } });
    expect(fixture.open).toHaveBeenCalledTimes(2); vi.mocked(fixture.windows[1].focus).mockImplementation(() => { throw new Error('Browser refused focus'); }); fixture.ready(); expect(await signing).toEqual(signature);
    fixture.windows[1].close();
    await provider.request({ method: 'disconnect' });
    expect(fixture.open).toHaveBeenCalledTimes(2);
    expect(await provider.request({ method: 'isConnected' })).toBe(false);
  });

  it('reports last approved identity while idle and updates it only from a genuine new connect response', async () => {
    const fixture = popupFixture(); const source = adapter(); const provider = source.provider() as CIP0103Provider;
    const connecting = provider.request({ method: 'connect' }); fixture.ready(); await connecting;
    fixture.windows[0].close();
    expect(await provider.request({ method: 'getPrimaryAccount' })).toMatchObject({ partyId: party.partyId });
    expect(await provider.request({ method: 'status' })).toMatchObject({ connection: { isConnected: true } });
    fixture.setParty({ ...party, partyId: 'party::newly-approved' });
    const accountChanges = vi.fn(); provider.on('accountsChanged', accountChanges);
    const reconnecting = provider.request({ method: 'connect' }); fixture.ready(); await reconnecting;
    expect(await provider.request({ method: 'getPrimaryAccount' })).toMatchObject({ partyId: 'party::newly-approved' });
    expect(accountChanges).toHaveBeenCalledWith([expect.objectContaining({ partyId: 'party::newly-approved' })]);
  });

  it('rejects unapproved/invalid/unsupported operations and preserves wallet error codes', async () => {
    const fixture = popupFixture(); const source = adapter(); const provider = source.provider() as CIP0103Provider;
    await expect(provider.request({ method: 'signMessage', params: { message: 'unapproved' } })).rejects.toMatchObject({ code: 4100 });
    expect(fixture.open).not.toHaveBeenCalled();
    const connecting = provider.request({ method: 'connect' }); fixture.ready(); await connecting;
    for (const params of [{}, { message: '' }, { message: 42 }, null, []]) await expect(provider.request({ method: 'signMessage', params: params as never })).rejects.toMatchObject({ code: -32602 });
    for (const params of [{}, { commands: [] }, { commands: 'bad' }]) await expect(provider.request({ method: 'prepareExecute', params })).rejects.toMatchObject({ code: -32602 });
    await expect(provider.request({ method: 'ledgerApi' })).rejects.toMatchObject({ code: 4200 });
    await expect(provider.request({ method: 'prepareExecuteAndWait' })).rejects.toMatchObject({ code: 4200 });
    fixture.setError({ code: 4001, message: 'User declined approval' });
    await expect(provider.request({ method: 'signMessage', params: { message: 'decline' } })).rejects.toMatchObject({ code: 4001, message: 'User declined approval' });
  });

  it('ignores spoofed ready/source/origin, mismatched ids and replayed replies', async () => {
    const fixture = popupFixture(false); const source = adapter(); const provider = source.provider() as CIP0103Provider;
    const connecting = provider.request({ method: 'connect' });
    const popup = fixture.windows[0];
    fixture.reply(popup, { type: 'oneswap:cip0103:ready' }, 'https://spoof.example');
    fixture.reply(popup, { type: 'oneswap:cip0103:ready' }, origin, window);
    await settle(); expect(fixture.requests).toHaveLength(0);
    fixture.ready(); await settle(); expect(fixture.requests).toHaveLength(1);
    const connectId = fixture.requests[0].id;
    const result = { primaryAccount: party, accounts: [party], network: 'devnet' };
    let resolved = false; void connecting.then(() => { resolved = true; });
    fixture.reply(popup, { id: connectId, result }, 'https://spoof.example');
    fixture.reply(popup, { id: connectId, result }, origin, window);
    fixture.reply(popup, { id: 'unrelated-request', result });
    fixture.reply(popup, { id: typeof connectId === 'number' ? String(connectId) : 1, result });
    await settle(); expect(resolved).toBe(false);
    fixture.reply(popup, { id: connectId, result }); await connecting;
    const signing = provider.request({ method: 'signMessage', params: { message: 'bound request' } }); await settle();
    let signed = false; void signing.then(() => { signed = true; });
    fixture.reply(popup, { id: connectId, result: { signature: 'replayed' } }); await settle(); expect(signed).toBe(false);
    fixture.reply(popup, { id: fixture.requests.at(-1)!.id, result: signature }); expect(await signing).toEqual(signature);
  });

  it('correlates concurrent requests and accepts a void disconnect reply with no result property', async () => {
    const fixture = popupFixture(false); const source = adapter(); const provider = source.provider() as CIP0103Provider;
    const connecting = provider.request({ method: 'connect' }); fixture.ready(); await settle();
    fixture.reply(fixture.windows[0], { id: fixture.requests[0].id, error: null, result: { primaryAccount: party } }); await connecting;
    const first = provider.request({ method: 'signMessage', params: { message: 'first' } });
    const second = provider.request({ method: 'signMessage', params: { message: 'second' } }); await settle();
    fixture.reply(fixture.windows[0], { id: fixture.requests[2].id, result: { ...signature, signature: 'second' } });
    fixture.reply(fixture.windows[0], { id: fixture.requests[1].id, result: { ...signature, signature: 'first' } });
    expect(await first).toMatchObject({ signature: 'first' }); expect(await second).toMatchObject({ signature: 'second' });
    const disconnecting = provider.request({ method: 'disconnect' }); await settle();
    fixture.reply(fixture.windows[0], { id: fixture.requests.at(-1)!.id }); await disconnecting;
    expect(await provider.request({ method: 'isConnected' })).toBe(false);
  });

  it('reports blocked popup, readiness timeout and request timeout with structured errors', async () => {
    vi.useFakeTimers(); const fixture = popupFixture(false); const source = adapter(); const provider = source.provider() as CIP0103Provider;
    fixture.open.mockReturnValueOnce(null);
    await expect(provider.request({ method: 'connect' })).rejects.toMatchObject({ code: 4100 });
    const noReady = provider.request({ method: 'connect' }); const noReadyCheck = expect(noReady).rejects.toMatchObject({ code: 4100 });
    await vi.advanceTimersByTimeAsync(5_000); await noReadyCheck;
    const noResponse = provider.request({ method: 'connect' }); fixture.ready(); await settle();
    const noResponseCheck = expect(noResponse).rejects.toMatchObject({ code: 4900 });
    await vi.advanceTimersByTimeAsync(5_000); await noResponseCheck;
  });
});

describe('generic hosted transport cancellation safeguards', () => {
  it('isolates two channels even when an adversarial opener returns the same WindowProxy', async () => {
    const fixture = popupFixture(false);
    const first = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' });
    const second = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(first, second);
    const a = first.provider() as CIP0103Provider; const b = second.provider() as CIP0103Provider;
    const connectingA = a.request({ method: 'connect' }); const popup = fixture.windows[0];
    // Model a reused named-window proxy, even though the generated names are distinct.
    fixture.open.mockReturnValueOnce(popup);
    const connectingB = b.request({ method: 'connect' });
    expect(fixture.open.mock.calls[0][1]).not.toBe(fixture.open.mock.calls[1][1]);
    fixture.reply(popup, { type: 'oneswap:cip0103:ready' }); await settle();
    expect(fixture.requests).toHaveLength(2); expect(fixture.requests[0].id).not.toBe(fixture.requests[1].id);
    let secondConnected = false; void connectingB.then(() => { secondConnected = true; });
    fixture.reply(popup, { id: fixture.requests[0].id, result: { primaryAccount: party } }); await connectingA; await settle();
    expect(secondConnected).toBe(false);
    fixture.reply(popup, { id: fixture.requests[1].id, result: { primaryAccount: { ...party, partyId: 'party::second' } } }); await connectingB;
    expect(await a.request({ method: 'getPrimaryAccount' })).toMatchObject({ partyId: party.partyId });
    expect(await b.request({ method: 'getPrimaryAccount' })).toMatchObject({ partyId: 'party::second' });
  });

  it('owns a distinct popup per adapter so teardown cannot close another pending session', async () => {
    const fixture = popupFixture(false);
    const first = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' });
    const second = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(first, second);
    const a = first.provider() as CIP0103Provider; const b = second.provider() as CIP0103Provider;
    const connectingA = a.request({ method: 'connect' }); const connectingB = b.request({ method: 'connect' });
    expect(fixture.open.mock.calls[0][1]).not.toBe(fixture.open.mock.calls[1][1]);
    const checkA = expect(connectingA).rejects.toMatchObject({ code: 4900 }); first.teardown?.(); await checkA;
    expect(fixture.windows[1].closed).toBe(false);
    fixture.reply(fixture.windows[1], { type: 'oneswap:cip0103:ready' }); await settle();
    fixture.reply(fixture.windows[1], { id: fixture.requests[0].id, result: { primaryAccount: party } }); await connectingB;
    expect(await b.request({ method: 'isConnected' })).toBe(true);
  });

  it('teardown cancels a pending handshake and rejects late connection replies', async () => {
    const fixture = popupFixture(false); const source = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(source);
    const provider = source.provider() as CIP0103Provider;
    const connecting = provider.request({ method: 'connect' });
    const check = expect(connecting).rejects.toMatchObject({ code: 4900 }); source.teardown?.();
    fixture.ready(); await check;
    expect(await provider.request({ method: 'isConnected' })).toBe(false); expect(fixture.requests).toHaveLength(0);
  });
  it('teardown cancels a request already sent and a late wallet reply cannot establish a session', async () => {
    const fixture = popupFixture(false); const source = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(source);
    const provider = source.provider() as CIP0103Provider; const connected = vi.fn(); provider.on('connected', connected);
    const connecting = provider.request({ method: 'connect' }); fixture.ready(); await settle();
    const popup = fixture.windows[0]; const id = fixture.requests[0].id;
    const check = expect(connecting).rejects.toMatchObject({ code: 4900 }); source.teardown?.();
    fixture.reply(popup, { id, result: { primaryAccount: party } }); await check;
    expect(await provider.request({ method: 'isConnected' })).toBe(false); expect(connected).not.toHaveBeenCalled();
  });

  it('retains the existing generic discovery owner and executes a wallet transaction once', async () => {
    const fixture = popupFixture(); const source = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(source);
    const adapter = new GenericDiscoveryAdapter({ official: source }); const context = { network: 'devnet' } as AdapterContext;
    const connecting = adapter.connect(context); fixture.ready(); const connection = await connecting; const session = connection.session as Session;
    expect(connection.partyId).toBe(party.partyId);
    expect(await adapter.signMessage(context, session, { message: 'UTF8 — intent' })).toEqual({ signature: signature.signature, partyId: party.partyId, message: 'UTF8 — intent' });
    const commands = [{ ExerciseCommand: { templateId: 'pkg:Module:Token', contractId: 'contract', choice: 'Transfer', choiceArgument: {} } }];
    expect(await adapter.submitTransaction(context, session, { signedTx: { commands } })).toEqual({ transactionHash: receipt.transactionHash, updateId: receipt.updateId, submittedAt: Date.parse(receipt.submittedAt) });
    expect(fixture.requests.filter(request => request.method === 'canton_prepareSignExecute')).toHaveLength(1);
    await adapter.disconnect(); expect(fixture.windows[0].closed).toBe(true);
  });

  it('rejects an in-flight request when the popup closes and clears every pending timer', async () => {
    vi.useFakeTimers(); const fixture = popupFixture(false); const source = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(source);
    const provider = source.provider() as CIP0103Provider;
    const connecting = provider.request({ method: 'connect' }); fixture.ready(); await settle();
    const check = expect(connecting).rejects.toMatchObject({ code: 4900 }); fixture.windows[0].close(); await vi.advanceTimersByTimeAsync(100); await check;
    expect(await provider.request({ method: 'isConnected' })).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['popup close', 'disconnect'] as const)('keeps a dispatched write outcome unknown after %s, with no failed event or replay', async mode => {
    const fixture = popupFixture(); const source = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet', providerId: 'oneswap' }); adapters.push(source);
    const client = createPartyLayer({ network: 'devnet', adapters: [source], deferInitialization: true, discovery: { announce: false }, app: { name: 'Unknown outcome test', origin: window.location.origin } });
    const entry = { id: 'oneswap', name: 'OneSwap', supportedNetworks: ['devnet' as const], capabilities: { signMessage: true, signTransaction: false, submitTransaction: true, transactionStatus: false, switchNetwork: false, multiParty: false }, adapter: { type: 'hosted-fixture', transport: 'discovery-adapter' as const, config: { providerId: 'oneswap' } } };
    vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([registryEntryToWalletInfo(entry, 'stable')]);
    vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({ metadata: { registryVersion: '1', schemaVersion: '1.0.0', publishedAt: '2026-11-15T00:00:00Z', channel: 'stable', sequence: 1 }, wallets: [entry] });
    vi.spyOn(client.registryClient, 'getWalletEntry').mockResolvedValue(entry);
    const bridge = createProviderBridge(client); const txEvents: { status: string; commandId?: string }[] = [];
    bridge.on('txChanged', event => txEvents.push(event as { status: string; commandId?: string }));
    const sdkStatuses: string[] = []; client.on('tx:status', event => sdkStatuses.push((event as { status: string }).status));
    try {
      const prepared = await client.prepareConnect({ walletId: 'oneswap' as never });
      const connecting = prepared.connect(); fixture.ready(); const session = await connecting;
      const commands = [{ ExerciseCommand: { templateId: 'pkg:Module:Token', contractId: 'contract', choice: 'Transfer', choiceArgument: {} } }];
      const completed = await client.submitTransaction({ signedTx: { commands, commandId: 'completed-command' } });
      expect(completed).toMatchObject({ updateId: receipt.updateId, commandId: 'completed-command' });
      fixture.setAutomatic(false);
      const uncertain = bridge.request({ method: 'prepareExecute', params: { commands, commandId: 'uncertain-command' } });
      const rejected = expect(uncertain).rejects.toThrow();
      await vi.waitFor(() => expect(fixture.requests.filter(request => request.method === 'canton_prepareSignExecute')).toHaveLength(2));
      const dispatched = fixture.requests.at(-1)!; const popup = fixture.windows.at(-1)!;
      if (mode === 'popup close') popup.close();
      else { fixture.setAutomatic(true); await client.disconnect(); }
      await rejected;
      fixture.reply(popup, { id: dispatched.id, result: receipt }); await settle();
      expect(fixture.requests.filter(request => request.method === 'canton_prepareSignExecute')).toHaveLength(2);
      expect(txEvents.filter(event => event.commandId === 'uncertain-command')).toEqual([{ status: 'pending', commandId: 'uncertain-command' }]);
      expect(sdkStatuses).toEqual(['submitted']);
      expect(completed).toMatchObject({ updateId: receipt.updateId, commandId: 'completed-command' });
      const fetcher = vi.fn();
      const reader = createApplicationLedgerReader(client, { endpoint: '/api/read', origin: window.location.origin, sourceId: 'test', networkId: 'canton:da-devnet', fetch: fetcher });
      expect(await reader.confirmTransaction({ transaction: { walletId: String(session.walletId), partyId: String(session.partyId), networkId: 'canton:da-devnet', commandId: 'uncertain-command' } })).toMatchObject({ status: 'unknown' });
      expect(fetcher).not.toHaveBeenCalled();
    } finally { client.destroy(); }
  });

  it('rejects malformed envelopes/params before opening a popup and rejects unsafe host paths', async () => {
    const fixture = popupFixture(); const source = createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet' }); adapters.push(source);
    const provider = source.provider() as CIP0103Provider;
    for (const args of [null, [], {}, { method: 42 }]) await expect(provider.request(args as never)).rejects.toMatchObject({ code: -32600 });
    await expect(provider.request({ method: 'connect', params: null as never })).rejects.toMatchObject({ code: -32602 });
    expect(fixture.open).not.toHaveBeenCalled();
    for (const connectPath of ['//other.example/connect', 'https://other.example/connect']) expect(() => createOneSwapHostedAdapter({ walletUrl: origin, networkId: 'canton:da-devnet', connectPath })).toThrow();
  });
});
