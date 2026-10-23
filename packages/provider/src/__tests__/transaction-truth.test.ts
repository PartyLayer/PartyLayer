import { describe, expect, it, vi } from 'vitest';
import { createProviderBridge, type BridgeableClient } from '../bridge';

const session = { sessionId: 'session', walletId: 'wallet', partyId: 'alice', network: 'devnet',
  capabilitiesSnapshot: ['connect', 'submitTransaction'] };
const params = { commandId: 'requested-command', commands: [{ CreateCommand: {} }] };
function setup(overrides: Partial<BridgeableClient> = {}) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const client: BridgeableClient = {
    connect: vi.fn(async () => session), disconnect: vi.fn(async () => {}),
    getActiveSession: vi.fn(async () => session), signMessage: vi.fn(async () => ({ signature: 'signature' })),
    signTransaction: vi.fn(async () => ({ signedTx: { encoded: 'signed' }, transactionHash: 'hash', partyId: 'alice' })),
    submitTransaction: vi.fn(async () => ({ commandId: params.commandId })),
    getRegistryStatus: () => null,
    on: vi.fn((name, handler) => { handlers[name] = handler; return () => {}; }), ...overrides,
  };
  const provider = createProviderBridge(client);
  const events: Array<{ status: string; commandId: string; payload?: unknown }> = [];
  provider.on('txChanged', (event: unknown) => events.push(event as typeof events[number]));
  return { client, provider, events, fire: (event: unknown) => handlers['tx:status'](event) };
}

describe('provider transaction truth and combined-wallet routing', () => {
  it('submits combined-only wallets once, preserving commands and caller correlation without sign-only or fake confirmation', async () => {
    const { client, provider, events } = setup();
    await provider.request({ method: 'prepareExecute', params });
    expect(client.signTransaction).not.toHaveBeenCalled();
    expect(client.submitTransaction).toHaveBeenCalledTimes(1);
    expect(client.submitTransaction).toHaveBeenCalledWith({ signedTx: params });
    expect(events).toEqual([{ status: 'pending', commandId: params.commandId }]);
  });

  it('never treats a transaction hash as a signature or a command id as a ledger update', async () => {
    const { provider, events } = setup({ getActiveSession: vi.fn(async () => ({ ...session, capabilitiesSnapshot: ['signTransaction'] })) });
    await provider.request({ method: 'prepareExecute', params });
    expect(events.map(event => event.status)).toEqual(['pending']);
  });

  it('emits an executed event only with an actual update and completion offset', async () => {
    const { provider, events } = setup({ submitTransaction: vi.fn(async () => ({ updateId: 'ledger-update', completionOffset: 42 })) });
    await provider.request({ method: 'prepareExecute', params });
    expect(events[1]).toEqual({ status: 'executed', commandId: params.commandId,
      payload: { updateId: 'ledger-update', completionOffset: 42 } });
  });

  it.each([undefined, -1, 1.25, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('does not invent a completion offset from %j', async completionOffset => {
    const { provider, events } = setup({ submitTransaction: vi.fn(async () => ({ updateId: 'ledger-update', completionOffset })) });
    await provider.request({ method: 'prepareExecute', params });
    expect(events.map(event => event.status)).toEqual(['pending']);
  });

  it('leaves lost submit responses unknown and never writes again', async () => {
    const { client, provider, events } = setup({ submitTransaction: vi.fn(async () => { throw new Error('Response lost after ledger acceptance'); }) });
    await expect(provider.request({ method: 'prepareExecute', params })).rejects.toThrow(/Response lost/);
    expect(client.submitTransaction).toHaveBeenCalledTimes(1);
    expect(events.map(event => event.status)).toEqual(['pending']);
  });

  it('reports explicit user rejection without retrying the write', async () => {
    const { client, provider, events } = setup({ submitTransaction: vi.fn(async () => { throw Object.assign(new Error('Rejected'), { code: 4001 }); }) });
    await expect(provider.request({ method: 'prepareExecute', params })).rejects.toMatchObject({ code: 4001 });
    expect(client.submitTransaction).toHaveBeenCalledTimes(1);
    expect(events.map(event => event.status)).toEqual(['pending', 'failed']);
  });

  it('does not submit after the session changes during separate signing', async () => {
    const getActiveSession = vi.fn().mockResolvedValueOnce({ ...session, capabilitiesSnapshot: ['signTransaction'] })
      .mockResolvedValueOnce({ ...session, partyId: 'bob' });
    const { client, provider, events } = setup({ getActiveSession });
    await expect(provider.request({ method: 'prepareExecute', params })).rejects.toThrow(/session changed/);
    expect(client.submitTransaction).not.toHaveBeenCalled();
    expect(events.map(event => event.status)).toEqual(['pending', 'failed']);
  });

  it('requires an actual signed payload instead of submitting its hash', async () => {
    const { client, provider } = setup({
      getActiveSession: vi.fn(async () => ({ ...session, capabilitiesSnapshot: ['signTransaction'] })),
      signTransaction: vi.fn(async () => ({ transactionHash: 'not-a-payload' })),
    });
    await expect(provider.request({ method: 'prepareExecute', params })).rejects.toThrow(/no signed transaction/);
    expect(client.submitTransaction).not.toHaveBeenCalled();
  });

  it('suppresses incomplete signed/committed events and forwards complete genuine payloads unchanged', () => {
    const { events, fire } = setup();
    fire({ status: 'committed', txId: 'command', raw: { commandId: 'command' } });
    fire({ status: 'signed', txId: 'command' });
    fire({ status: 'committed', raw: { updateId: 'update', completionOffset: 5 } });
    expect(events).toEqual([]);
    const payload = { signature: 'real-signature', signedBy: 'reported-key', party: 'alice' };
    fire({ status: 'signed', txId: 'command', raw: { payload } });
    fire({ status: 'committed', txId: 'command', raw: { payload: { updateId: 'update', completionOffset: 5 } } });
    expect(events).toEqual([
      { status: 'signed', commandId: 'command', payload },
      { status: 'executed', commandId: 'command', payload: { updateId: 'update', completionOffset: 5 } },
    ]);
  });

  it('rejects duplicate in-flight command ids and keeps a single wallet write', async () => {
    let done!: (value: { commandId: string }) => void;
    const pending = new Promise<{ commandId: string }>(resolve => { done = resolve; });
    const { client, provider } = setup({ submitTransaction: vi.fn(() => pending) });
    const first = provider.request({ method: 'prepareExecute', params });
    await vi.waitFor(() => expect(client.submitTransaction).toHaveBeenCalledTimes(1));
    await expect(provider.request({ method: 'prepareExecute', params })).rejects.toThrow(/already pending/);
    done({ commandId: params.commandId });
    await first;
    expect(client.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not claim Devnet when disconnected', async () => {
    const { provider } = setup({ getActiveSession: vi.fn(async () => null) });
    await expect(provider.request({ method: 'getActiveNetwork' })).rejects.toMatchObject({ code: 4900 });
  });
});
