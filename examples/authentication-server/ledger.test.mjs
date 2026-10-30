import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createAuthorizedLedgerProxy } from './ledger.mjs';

const servers = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); });
const identity = { partyId: 'alice', networkId: 'canton:da-devnet' };
const policy = { bearerToken: 'test-only-ledger-credential', holdingInterfaceId: 'package:Splice.Api.Token.HoldingV1:Holding', sourceId: 'devnet', networkId: identity.networkId };
async function ledger(respond = (_request, response) => { response.setHeader('Content-Type', 'application/json'); response.end('[]'); }) {
  const requests = []; const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    requests.push({ path: request.url, method: request.method, headers: request.headers, body: raw ? JSON.parse(raw) : undefined }); respond(request, response);
  }); servers.push(server); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return { requests, url: `http://127.0.0.1:${server.address().port}/` };
}
const input = resource => ({ version: 1, sourceId: policy.sourceId, ...identity, resource });
test('rebuilds party and interface filters server-side and never forwards arbitrary input or credentials', async () => {
  const source = await ledger(); const proxy = createAuthorizedLedgerProxy({ ...policy, url: source.url });
  const result = await proxy(identity, { ...input('/v2/state/active-contracts'), body: { activeAtOffset: 123, actAs: ['admin'],
    eventFormat: { filtersForAnyParty: {}, filtersByParty: { bob: {} } }, commands: ['malicious'] }, headers: { Authorization: 'attacker' } });
  assert.equal(result.complete, true); assert.equal(result.partyId, 'alice');
  const actual = source.requests[0]; assert.equal(actual.method, 'POST'); assert.equal(actual.headers.authorization, `Bearer ${policy.bearerToken}`);
  assert.deepEqual(Object.keys(actual.body.eventFormat.filtersByParty), ['alice']);
  assert.equal(actual.body.eventFormat.filtersByParty.alice.cumulative[0].identifierFilter.InterfaceFilter.value.interfaceId, policy.holdingInterfaceId);
  assert.equal(actual.body.actAs, undefined); assert.equal(actual.body.commands, undefined); assert.equal(actual.body.eventFormat.filtersForAnyParty, undefined);
});
test('rejects another party/network/source and every write or arbitrary URL before issuing an upstream request', async () => {
  const source = await ledger(); const proxy = createAuthorizedLedgerProxy({ ...policy, url: source.url });
  for (const wrong of [{ partyId: 'bob' }, { networkId: 'canton:da-mainnet' }, { sourceId: 'another' }, { resource: '/v2/commands/submit-and-wait' }, { resource: '/v2/interactive-submission/execute' }, { resource: 'https://other.example/' }]) {
    await assert.rejects(proxy(identity, { ...input('/v2/state/ledger-end'), ...wrong }), error => error.status === 403);
  }
  assert.equal(source.requests.length, 0);
});
test('scopes update reads to the authenticated party and validates offsets', async () => {
  const source = await ledger(); const proxy = createAuthorizedLedgerProxy({ ...policy, url: source.url });
  await assert.rejects(proxy(identity, { ...input('/v2/state/active-contracts'), body: { activeAtOffset: Number.MAX_SAFE_INTEGER + 1 } }));
  await proxy(identity, { ...input('/v2/updates/update-by-id'), body: { updateId: 'ledger-update', updateFormat: { includeTopologyEvents: {} } } });
  assert.deepEqual(source.requests[0].body, { updateId: 'ledger-update', updateFormat: { includeTransactions: {
    eventFormat: { filtersByParty: { alice: {} }, verbose: false }, transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA',
  } } });
});
test('rejects redirects/HTML and invalid server URLs without exposing the ledger credential', async () => {
  for (const url of ['http://untrusted.example/', 'https://user:password@example.com/', 'https://example.com/?next=other']) assert.throws(() => createAuthorizedLedgerProxy({ ...policy, url }));
  const html = await ledger((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('Cloudflare'); });
  await assert.rejects(createAuthorizedLedgerProxy({ ...policy, url: html.url })(identity, input('/v2/state/ledger-end')), /unavailable/);
  const redirect = await ledger((_request, response) => { response.writeHead(302, { Location: 'https://other.example/' }); response.end(); });
  await assert.rejects(createAuthorizedLedgerProxy({ ...policy, url: redirect.url })(identity, input('/v2/state/ledger-end')));
});
