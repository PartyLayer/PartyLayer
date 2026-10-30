import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@partylayer/core';
import { createWalletLedgerReader, type WalletLedgerClient } from './wallet-ledger-reader';

const interfaceId = 'abc123:Splice.Api.Token.HoldingV1:Holding';
const options = { networkId: 'canton:da-devnet', holdingInterfaceId: interfaceId };
let session: Session | null;
const request = vi.fn();
const client: WalletLedgerClient = {
  getActiveSession: async () => session,
  asProvider: () => ({ request }),
};
const row = () => ({ contractEntry: { JsActiveContract: { createdEvent: {
  contractId: 'holding-1', interfaceViews: [{ interfaceId, viewStatus: { code: 0 }, viewValue: {
    owner: 'alice', instrumentId: { admin: 'issuer', id: 'USD' }, amount: '999999999999999999.1234567890',
    lock: { holders: ['escrow'], expiresAt: null, expiresAfter: null, context: null }, meta: { values: { name: 'Dollar' } },
  } }],
} } } });
beforeEach(() => {
  session = { sessionId: 'session-1', walletId: 'vala', partyId: 'alice', network: 'devnet', capabilitiesSnapshot: ['ledgerApi'] } as Session;
  request.mockReset().mockImplementation(async ({ params }) => params.resource === '/v2/state/ledger-end' ? { offset: 123 } : [row()]);
});

describe('authorized wallet Ledger API v2 reads', () => {
  it('uses exact party/interface filters and retains decimal precision and locks', async () => {
    const result = await createWalletLedgerReader(client, options).readHoldings();
    expect(result).toMatchObject({ partyId: 'alice', networkId: options.networkId, offset: 123 });
    expect(result.holdings[0].holding).toMatchObject({ amount: '999999999999999999.1234567890', lock: { holders: ['escrow'] }, meta: { name: 'Dollar' } });
    expect(request.mock.calls[1][0]).toEqual({ method: 'ledgerApi', params: { requestMethod: 'post', resource: '/v2/state/active-contracts', body: {
      activeAtOffset: 123, eventFormat: { filtersByParty: { alice: { cumulative: [{ identifierFilter: { InterfaceFilter: { value: { interfaceId, includeInterfaceView: true } } } }] } }, verbose: false },
    } } });
    expect(request.mock.calls.every(([args]) => !/commands|prepare|execute/.test(args.params.resource))).toBe(true);
  });

  it('supports the existing compatibility response envelope', async () => {
    request.mockImplementation(async ({ params }) => ({ response: JSON.stringify(params.resource.endsWith('ledger-end') ? { offset: 0 } : []) }));
    expect((await createWalletLedgerReader(client, options).readHoldings()).holdings).toEqual([]);
  });

  it.each(['disconnected', 'wrong-network', 'mismatch', 'no-capability'])('blocks %s before calling the wallet ledger', async kind => {
    if (kind === 'disconnected') session = null;
    else if (kind === 'wrong-network') session!.network = 'mainnet' as Session['network'];
    else if (kind === 'mismatch') session!.networkMismatch = true;
    else session!.capabilitiesSnapshot = [];
    await expect(createWalletLedgerReader(client, options).readHoldings()).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['owner', 'interface', 'status', 'amount', 'duplicate', 'reassignment', 'limit'])('rejects an unsafe %s snapshot instead of returning zero', async kind => {
    const r = row(); const v = r.contractEntry.JsActiveContract.createdEvent.interfaceViews[0];
    if (kind === 'owner') v.viewValue.owner = 'bob';
    if (kind === 'interface') v.interfaceId = 'unrequested-interface';
    if (kind === 'status') v.viewStatus.code = 13;
    if (kind === 'amount') v.viewValue.amount = '1e9';
    const rows = kind === 'duplicate' ? [r, r] : kind === 'reassignment' ? [{ contractEntry: { JsIncompleteAssigned: {} } }] : [r];
    request.mockImplementation(async ({ params }) => params.resource.endsWith('ledger-end') ? { offset: 123 } : rows);
    await expect(createWalletLedgerReader(client, { ...options, maxContracts: kind === 'limit' ? 1 : 1000 }).readHoldings()).rejects.toThrow();
  });

  it('rejects unsafe int64 offsets without querying a rounded snapshot', async () => {
    request.mockResolvedValue({ offset: Number.MAX_SAFE_INTEGER + 1 });
    await expect(createWalletLedgerReader(client, options).readHoldings()).rejects.toThrow(/offset/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('discards reads after a disconnect/reconnect even with the same account', async () => {
    request.mockImplementation(async () => { session = { ...session!, sessionId: 'session-2' as Session['sessionId'] }; return { offset: 123 }; });
    await expect(createWalletLedgerReader(client, options).readHoldings()).rejects.toThrow(/changed/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('honors cancellation and a timeout even if the provider never responds', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(createWalletLedgerReader(client, options).readHoldings(controller.signal)).rejects.toThrow(/cancelled/);
    expect(request).not.toHaveBeenCalled();
    request.mockImplementation(() => new Promise(() => {}));
    await expect(createWalletLedgerReader(client, { ...options, timeoutMs: 10 }).readHoldings()).rejects.toThrow(/timed out/);
  });

  const transaction = () => ({ walletId: 'vala', partyId: 'alice', networkId: options.networkId, commandId: 'original-command', receipt: { submittedAt: 1, updateId: 'update-1' } });
  it('confirms only a ledger transaction correlated with the original app command', async () => {
    request.mockResolvedValue({ update: { Transaction: { value: { updateId: 'update-1', commandId: 'original-command', events: [] } } } });
    const result = await createWalletLedgerReader(client, options).confirmTransaction({ transaction: transaction() });
    expect(result).toEqual({ status: 'confirmed', updateId: 'update-1' });
    expect(request.mock.calls[0][0].params).toMatchObject({ resource: '/v2/updates/update-by-id', body: { updateId: 'update-1' } });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(['different-command', 'missing-command', 'different-update'])('does not confirm %s', async kind => {
    request.mockResolvedValue({ update: { Transaction: { value: { updateId: kind === 'different-update' ? 'other-update' : 'update-1', commandId: kind === 'missing-command' ? '' : 'unrelated', events: [] } } } });
    expect((await createWalletLedgerReader(client, options).confirmTransaction({ transaction: transaction() })).status).toBe('unknown');
  });
  it('does not treat an uncorrelated receipt as confirmation', async () => {
    expect((await createWalletLedgerReader(client, options).confirmTransaction({ transaction: { ...transaction(), commandId: undefined } })).status).toBe('unknown');
    expect(request).not.toHaveBeenCalled();
  });
  it('never reads another account or network to confirm an update', async () => {
    await expect(createWalletLedgerReader(client, options).confirmTransaction({ transaction: { ...transaction(), partyId: 'bob' } })).rejects.toThrow(/belong/);
    expect(request).not.toHaveBeenCalled();
  });
});
