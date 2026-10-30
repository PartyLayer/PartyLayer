import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import { once } from 'node:events';
import { Pool } from 'pg';
import { createAuthenticationChallenge, formatAuthenticationMessage } from '@partylayer/core/authentication';
import { createAuthenticationServer } from './server.mjs';
import { createStore } from './store.mjs';

const connectionString = process.env.PARTYLAYER_TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set PARTYLAYER_TEST_DATABASE_URL to a dedicated PostgreSQL test database');
const database = new Pool({ connectionString, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
after(() => database.end());
const random = () => randomBytes(32).toString('base64url');
const identity = { partyId: 'integration-test-party', networkId: 'canton:da-devnet' };
const origin = 'http://localhost:3187';
const challenge = () => createAuthenticationChallenge({ ...identity, origin, nonce: random() });

test('real PostgreSQL connections atomically consume a browser-bound nonce once', async () => {
  const a = await createStore(database); const b = await createStore(database);
  const browser = random(); const c = challenge(); await a.insert(c, browser);
  assert.equal(await b.consume(c.nonce, random()), null);
  const results = await Promise.all([a.consume(c.nonce, browser), b.consume(c.nonce, browser)]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(results.find(Boolean).partyId, identity.partyId);
});

test('concurrent establishment/logout across PostgreSQL connections never leaves a late session', async () => {
  const a = await createStore(database); const b = await createStore(database);
  for (let i = 0; i < 10; i++) {
    const browser = random(); const token = random(); const c = challenge(); await a.insert(c, browser); await a.consume(c.nonce, browser);
    const operations = [() => a.establish(token, identity, undefined, browser), () => b.logout(undefined, browser)];
    if (i % 2) operations.reverse();
    const results = await Promise.allSettled(operations.map(operation => operation()));
    assert.ok(results.some(result => result.status === 'fulfilled'));
    assert.equal(await a.session(token), null);
  }
});

test('two actual HTTP replicas share challenges, sessions and revocation through PostgreSQL', async () => {
  const keys = generateKeyPairSync('ed25519');
  const bindings = [{ ...identity, publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }), algorithm: 'ed25519', signatureEncoding: 'base64', messageEncoding: 'utf8' }];
  const a = await createAuthenticationServer({ origin, networkId: identity.networkId, bindings, database });
  const b = await createAuthenticationServer({ origin, networkId: identity.networkId, bindings, database });
  const start = async server => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return `http://127.0.0.1:${server.address().port}`; };
  const [urlA, urlB] = await Promise.all([start(a), start(b)]);
  const post = (url, path, body, cookie = '') => fetch(`${url}/api/auth/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  try {
    const response = await post(urlA, 'challenge', identity); assert.equal(response.status, 200);
    const c = await response.json(); const browserCookie = response.headers.getSetCookie()[0].split(';')[0];
    const signature = sign(null, Buffer.from(formatAuthenticationMessage(c)), keys.privateKey).toString('base64');
    const verified = await post(urlB, 'verify', { nonce: c.nonce, signature }, browserCookie); assert.equal(verified.status, 200);
    const cookie = verified.headers.getSetCookie().find(value => value.startsWith('partylayer-dev-session=')).split(';')[0];
    assert.deepEqual(await (await fetch(`${urlA}/api/auth/session`, { headers: { Cookie: cookie } })).json(), identity);
    assert.equal((await post(urlA, 'verify', { nonce: c.nonce, signature }, browserCookie)).status, 401);
    await post(urlA, 'logout', {}, cookie);
    assert.equal(await (await fetch(`${urlB}/api/auth/session`, { headers: { Cookie: cookie } })).json(), null);
  } finally {
    await Promise.all([a, b].map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })));
  }
});
