import { beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@partylayer/core';
import { createApplicationLedgerReader } from './application-ledger-reader';
import type { WalletLedgerClient } from './wallet-ledger-reader';

let session: Session | null;
const walletRequest = vi.fn(); const fetcher = vi.fn();
const client: WalletLedgerClient = { getActiveSession: async () => session, asProvider: () => ({ request: walletRequest }) };
const options = { endpoint: '/api/wallet-data', sourceId: 'app:devnet', origin: 'https://app.example', networkId: 'canton:da-devnet', holdingInterfaceId: 'abc:Splice.Api.Token.HoldingV1:Holding', fetch: fetcher };
beforeEach(() => {
  session = { sessionId: 'session', walletId: 'vala', partyId: 'alice', network: 'devnet', capabilitiesSnapshot: [] } as Session;
  walletRequest.mockReset(); fetcher.mockReset().mockImplementation(async (_url, init) => {
    const { resource } = JSON.parse(init.body);
    return Response.json({ version: 1, sourceId: options.sourceId, partyId: 'alice', networkId: options.networkId, resource, complete: true,
      value: resource.endsWith('ledger-end') ? { offset: 123 } : [] });
  });
});
it('reads the authenticated app source without requesting or claiming a wallet ledger capability', async () => {
  const snapshot = await createApplicationLedgerReader(client, options).readHoldings();
  expect(snapshot.holdings).toEqual([]); expect(session!.capabilitiesSnapshot).toEqual([]); expect(walletRequest).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[0][0]).toBe('https://app.example/api/wallet-data');
  expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});
it.each(['sourceId', 'partyId', 'networkId', 'resource', 'complete', 'version'])('rejects an unbound or incomplete %s envelope', async field => {
  fetcher.mockResolvedValue(Response.json({ version: 1, sourceId: options.sourceId, partyId: 'alice', networkId: options.networkId,
    resource: '/v2/state/ledger-end', complete: true, value: { offset: 123 }, [field]: 'wrong' }));
  await expect(createApplicationLedgerReader(client, options).readHoldings()).rejects.toThrow(/scoped/);
});
it.each(['https://other.example/data', 'https://user:password@app.example/data', '/api/data#fragment'])('blocks unsafe endpoint %s before fetching', async endpoint => {
  await expect(createApplicationLedgerReader(client, { ...options, endpoint }).readHoldings()).rejects.toThrow(/same-origin/); expect(fetcher).not.toHaveBeenCalled();
});
it('does not turn an expired application session into an empty portfolio', async () => {
  fetcher.mockResolvedValue(new Response('Sign in', { status: 401 }));
  await expect(createApplicationLedgerReader(client, options).readHoldings()).rejects.toThrow(/unavailable/);
});
it('aborts an in-flight HTTP read and never issues the following request', async () => {
  fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })));
  const controller = new AbortController(); const result = createApplicationLedgerReader(client, options).readHoldings(controller.signal);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce()); controller.abort();
  await expect(result).rejects.toThrow(/cancelled/); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true); expect(fetcher).toHaveBeenCalledOnce();
});
it('discards an otherwise valid response when the connected wallet identity changes', async () => {
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (...args) => { const response = await original(...args); session = { ...session!, partyId: 'bob' as Session['partyId'] }; return response; });
  await expect(createApplicationLedgerReader(client, options).readHoldings()).rejects.toThrow(/changed/);
});
