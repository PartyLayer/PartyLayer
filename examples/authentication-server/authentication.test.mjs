import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { formatAuthenticationMessage } from '@partylayer/core/authentication';
import { createAuthenticationServer } from './server.mjs';
import { createAuthorizedVerifier } from './verifier.mjs';
import { createStore } from './store.mjs';
import { PGlite } from '@electric-sql/pglite';

const origin = 'http://localhost:3187'; const networkId = 'canton:da-devnet';
const cleanups = [];
afterEach(async () => { for (const fn of cleanups.splice(0).reverse()) await fn(); });
function profile(algorithm = 'ed25519', signatureEncoding = 'base64', messageEncoding = 'utf8') {
  const keys = algorithm === 'ed25519' ? generateKeyPairSync('ed25519') : generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const binding = { partyId: 'alice', networkId, publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }), algorithm, signatureEncoding, messageEncoding };
  return { binding, signature: message => sign(algorithm === 'ed25519' ? null : 'sha256', Buffer.from(messageEncoding === 'utf8' ? message : Buffer.from(message).toString('base64')),
    { key: keys.privateKey, dsaEncoding: algorithm.endsWith('p1363') ? 'ieee-p1363' : 'der' }).toString(signatureEncoding) };
}
async function fixture(ledger) {
  const p = profile(); const database = new PGlite(); cleanups.push(() => database.close());
  const server = await createAuthenticationServer({ origin, networkId, bindings: [p.binding], database, ledger });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  cleanups.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '', extra = {}) => fetch(`${url}/api/auth/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, ...extra }, body: JSON.stringify(body) });
  const challenge = async () => {
    const r = await post('challenge', { partyId: 'alice', networkId }); assert.equal(r.status, 200);
    return { value: await r.json(), cookie: r.headers.getSetCookie()[0].split(';')[0] };
  };
  return { ...p, url, post, challenge };
}

test('real HTTP sign-in, rotated HttpOnly cookie, session lookup and logout', async () => {
  const f = await fixture(); const c = await f.challenge();
  const r = await f.post('verify', { nonce: c.value.nonce, signature: f.signature(formatAuthenticationMessage(c.value)) }, c.cookie);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { partyId: 'alice', networkId });
  const cookie = r.headers.getSetCookie().find(v => v.startsWith('partylayer-dev-session='));
  assert.match(cookie, /HttpOnly; SameSite=Strict/); assert.notEqual(cookie.split(';')[0].split('=')[1], c.cookie.split('=')[1]);
  const session = await fetch(`${f.url}/api/auth/session`, { headers: { Cookie: cookie.split(';')[0] } });
  assert.deepEqual(await session.json(), { partyId: 'alice', networkId }); assert.equal(session.headers.get('cache-control'), 'no-store');
  assert.equal((await f.post('logout', {}, cookie.split(';')[0])).status, 200);
  assert.equal(await (await fetch(`${f.url}/api/auth/session`, { headers: { Cookie: cookie.split(';')[0] } })).json(), null);
});
test('only one parallel proof can consume a nonce; wrong browser cannot consume it', async () => {
  const f = await fixture(); const c = await f.challenge(); const proof = { nonce: c.value.nonce, signature: f.signature(formatAuthenticationMessage(c.value)) };
  assert.equal((await f.post('verify', proof, 'partylayer-dev-preauth=' + 'x'.repeat(43))).status, 401);
  const results = await Promise.all([f.post('verify', proof, c.cookie), f.post('verify', proof, c.cookie)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 401]);
});
test('rejects foreign/missing origin, form posts, unknown party and another network', async () => {
  const f = await fixture();
  assert.equal((await f.post('challenge', { partyId: 'alice', networkId }, '', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.post('challenge', { partyId: 'alice', networkId }, '', { Origin: '' })).status, 403);
  assert.equal((await f.post('challenge', {}, '', { 'Content-Type': 'text/plain' })).status, 403);
  assert.equal((await f.post('challenge', { partyId: 'bob', networkId })).status, 403);
  assert.equal((await f.post('challenge', { partyId: 'alice', networkId: 'canton:da-mainnet' })).status, 403);
});
test('a client-supplied public key never authorizes a forged proof and a failed proof burns the nonce', async () => {
  const f = await fixture(); const attacker = profile(); const c = await f.challenge();
  assert.equal((await f.post('verify', { nonce: c.value.nonce, signature: attacker.signature(formatAuthenticationMessage(c.value)), publicKey: attacker.binding.publicKeyPem }, c.cookie)).status, 401);
  assert.equal((await f.post('verify', { nonce: c.value.nonce, signature: f.signature(formatAuthenticationMessage(c.value)) }, c.cookie)).status, 401);
});
test('logout invalidates outstanding browser-bound challenges', async () => {
  const f = await fixture(); const c = await f.challenge(); await f.post('logout', {}, c.cookie);
  assert.equal((await f.post('verify', { nonce: c.value.nonce, signature: f.signature(formatAuthenticationMessage(c.value)) }, c.cookie)).status, 401);
});
test('the optional ledger endpoint requires a live application session and rejects another party', async () => {
  let calls = 0;
  const upstream = createServer((_request, response) => { calls++; response.setHeader('Content-Type', 'application/json'); response.end('{"offset":123}'); });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  cleanups.push(() => new Promise(resolve => { upstream.closeAllConnections(); upstream.close(resolve); }));
  const f = await fixture({ url: `http://127.0.0.1:${upstream.address().port}/`, bearerToken: 'test-only', sourceId: 'app', holdingInterfaceId: 'package:Splice.Api.Token.HoldingV1:Holding' });
  const read = (partyId, cookie = '') => fetch(`${f.url}/api/wallet-data`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ version: 1, sourceId: 'app', partyId, networkId, resource: '/v2/state/ledger-end' }) });
  assert.equal((await read('alice')).status, 401); assert.equal(calls, 0);
  const challenge = await f.challenge(); const signed = await f.post('verify', { nonce: challenge.value.nonce, signature: f.signature(formatAuthenticationMessage(challenge.value)) }, challenge.cookie);
  const cookie = signed.headers.getSetCookie().find(value => value.startsWith('partylayer-dev-session=')).split(';')[0];
  assert.equal((await read('bob', cookie)).status, 403); assert.equal(calls, 0);
  const response = await read('alice', cookie); assert.equal(response.status, 200); assert.deepEqual((await response.json()).value, { offset: 123 }); assert.equal(calls, 1);
  await f.post('logout', {}, cookie); assert.equal((await read('alice', cookie)).status, 401); assert.equal(calls, 1);
});
test('SQL nonce consumption has one winner and persisted sessions survive a restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'partylayer-auth-test-')); cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'pgdata'); const db = new PGlite(path); const a = await createStore(db); const b = await createStore(db);
  await a.insert({ nonce: 'one', expiresAt: new Date(Date.now() + 60000).toISOString() }, 'browser');
  assert.equal(await b.consume('one', 'other'), null);
  const results = await Promise.all([a.consume('one', 'browser'), b.consume('one', 'browser')]); assert.equal(results.filter(Boolean).length, 1);
  await a.establish('secret-session', { partyId: 'alice', networkId }, undefined, 'browser'); await db.close();
  const restartedDb = new PGlite(path); const restarted = await createStore(restartedDb);
  assert.deepEqual(await restarted.session('secret-session'), { partyId: 'alice', networkId }); await restarted.logout('secret-session'); assert.equal(await restarted.session('secret-session'), null); await restartedDb.close();
});
test('logout prevents an already-consumed, in-flight proof from establishing a late session', async () => {
  const db = new PGlite(); const store = await createStore(db);
  try {
    await store.insert({ nonce: 'in-flight', expiresAt: new Date(Date.now() + 60000).toISOString() }, 'browser');
    assert.ok(await store.consume('in-flight', 'browser')); // Verification is now in flight.
    await store.logout(undefined, 'browser');
    await assert.rejects(store.establish('late-session', { partyId: 'alice', networkId }, undefined, 'browser'), /revoked/);
    assert.equal(await store.session('late-session'), null);
  } finally { await db.close(); }
});
for (const [algorithm, encoding, messageEncoding] of [['ed25519', 'base64', 'utf8'], ['ed25519', 'base64', 'base64-text'], ['p256-sha256-der', 'hex', 'utf8'], ['p256-sha256-p1363', 'hex', 'utf8']]) {
  test(`verifies exact bytes and strict ${algorithm}/${encoding}/${messageEncoding} format`, async () => {
    const p = profile(algorithm, encoding, messageEncoding); const verifier = createAuthorizedVerifier([p.binding]); const message = 'Hello Canton — İ';
    const signature = p.signature(message); const challenge = { partyId: 'alice', networkId };
    assert.equal(await verifier({ message, signature, challenge }), true);
    assert.equal(await verifier({ message: message + ' ', signature, challenge }), false);
    assert.equal(await verifier({ message, signature: signature + ' ', challenge }), false);
    assert.equal(await verifier({ message, signature, challenge: { ...challenge, partyId: 'bob' } }), false);
    assert.equal(await verifier({ message, signature, challenge: { ...challenge, networkId: 'canton:da-mainnet' } }), false);
    if (algorithm.endsWith('der')) assert.equal(await verifier({ message, signature: signature + '00', challenge }), false);
  });
}
test('refuses absent bindings, algorithm confusion and a mismatched key type', () => {
  assert.throws(() => createAuthorizedVerifier([])); const p = profile();
  assert.throws(() => createAuthorizedVerifier([{ ...p.binding, algorithm: 'rsa' }]));
  assert.throws(() => createAuthorizedVerifier([{ ...p.binding, algorithm: 'p256-sha256-der' }]));
});
