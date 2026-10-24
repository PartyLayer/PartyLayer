import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWalletHoldings } from './holdings';

const view = { owner: 'alice', instrumentId: { admin: 'issuer', id: 'TOKEN' }, amount: '9007199254740993.1' };
const entry = (cid = 'holding-1') => ({ contractEntry: { JsActiveContract: { createdEvent: {
  contractId: cid, interfaceViews: [{ interfaceId: '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding', viewValue: view }],
} } } });

function ledger(response: unknown, offset: unknown = 42) {
  const calls: Array<{ requestMethod: string; resource: string; body?: unknown }> = [];
  return {
    calls,
    async ledgerApi(request: { requestMethod: string; resource: string; body?: unknown }) {
      calls.push(request);
      return { response: JSON.stringify(calls.length === 1 ? { offset } : response) };
    },
  };
}

test('reads a consistent owner-filtered Holding snapshot without losing decimal precision', async () => {
  const client = ledger([entry()]);
  assert.deepEqual(await readWalletHoldings(client, 'alice'), [{ cid: 'holding-1', holding: view }]);
  assert.equal(client.calls[0].resource, '/v2/state/ledger-end');
  assert.equal(client.calls[1].resource, '/v2/state/active-contracts');
  const body = JSON.parse(String(client.calls[1].body));
  assert.equal(body.activeAtOffset, 42);
  assert.ok(body.eventFormat.filtersByParty.alice);
  assert.equal(body.eventFormat.filtersByParty.alice.cumulative[0].identifierFilter.InterfaceFilter.value.includeInterfaceView, true);
});

test('rejects incomplete pagination, duplicates, unsafe offsets and missing views instead of showing zero/partial totals', async () => {
  await assert.rejects(readWalletHoldings(ledger({ activeContracts: [entry()], nextPageToken: 'more' }), 'alice'), /paginated/);
  await assert.rejects(readWalletHoldings(ledger({ activeContracts: [entry()], nextPageToken: '' }), 'alice'), /paginated/);
  await assert.rejects(readWalletHoldings(ledger([{}]), 'alice'), /contract entry/);
  await assert.rejects(readWalletHoldings(ledger([entry(), entry()]), 'alice'), /unique/);
  const unsafe = ledger([entry()], Number.MAX_SAFE_INTEGER + 1);
  await assert.rejects(readWalletHoldings(unsafe, 'alice'), /offset/);
  assert.equal(unsafe.calls.length, 1);
  await assert.rejects(readWalletHoldings(ledger([{ contractEntry: { JsActiveContract: { createdEvent: { contractId: 'missing' } } } }]), 'alice'), /interface views/);
});

test('does not start a read after cancellation', async () => {
  const client = ledger([]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(readWalletHoldings(client, 'alice', controller.signal), /cancelled/);
  assert.equal(client.calls.length, 0);
});
