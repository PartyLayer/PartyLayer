import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { createAuthenticationChallenge, verifyAuthenticationProof } from '@partylayer/core/authentication';
import { createStore } from './store.mjs';
import { createAuthorizedVerifier } from './verifier.mjs';
import { createAuthorizedLedgerProxy } from './ledger.mjs';

const random = () => randomBytes(32).toString('base64url');
const validToken = value => typeof value === 'string' && /^[\w-]{43}$/.test(value);

export async function createAuthenticationServer({ origin, networkId, bindings, database, ledger }) {
  // Core validates origin/network policy at startup, never from Host/forwarded headers.
  createAuthenticationChallenge({ origin, networkId, partyId: 'configuration-check', nonce: random() });
  const verifySignatureAndParty = createAuthorizedVerifier(bindings);
  const store = await createStore(database);
  const ledgerRead = ledger ? createAuthorizedLedgerProxy({ ...ledger, networkId }) : null;
  const secure = new URL(origin).protocol === 'https:';
  const name = secure ? '__Host-partylayer-session' : 'partylayer-dev-session';
  const preauth = secure ? '__Host-partylayer-preauth' : 'partylayer-dev-preauth';
  const cookie = (key, value, maxAge) => `${key}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const server = createServer({ requestTimeout: 10_000, headersTimeout: 10_000, maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)); };
    try {
      const cookies = Object.fromEntries((request.headers.cookie ?? '').split(';').map(item => item.trim().split('=')));
      const token = validToken(cookies[name]) ? cookies[name] : undefined;
      const browser = validToken(cookies[preauth]) ? cookies[preauth] : undefined;
      if (request.method === 'GET' && request.url === '/api/auth/session') { send(200, await store.session(token)); return; }
      if (request.method !== 'POST' || !['/api/auth/challenge', '/api/auth/verify', '/api/auth/logout', '/api/wallet-data'].includes(request.url)) { send(404, { error: 'Not found' }); return; }
      if (request.headers.origin !== origin || request.headers['content-type']?.split(';')[0].trim() !== 'application/json') { send(403, { error: 'Origin or content type rejected' }); return; }
      if (!await store.limit(request.socket.remoteAddress, request.url)) { send(429, { error: 'Too many requests' }); return; }
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 16_384) { send(413, { error: 'Body too large' }); return; } chunks.push(chunk); }
      const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      if (!body || typeof body !== 'object' || Array.isArray(body)) { send(400, { error: 'Invalid body' }); return; }
      if (request.url === '/api/wallet-data') {
        if (!ledgerRead) { send(404, { error: 'Ledger reads are not configured' }); return; }
        const identity = await store.session(token);
        if (!identity) { send(401, { error: 'Sign in first' }); return; }
        try {
          const value = await ledgerRead(identity, body);
          const current = await store.session(token);
          if (!current || current.partyId !== identity.partyId || current.networkId !== identity.networkId) { send(401, { error: 'Session changed during read' }); return; }
          send(200, value);
        } catch (reason) { send(reason?.status === 403 ? 403 : 502, { error: 'Authorized ledger read unavailable' }); }
        return;
      }
      if (request.url === '/api/auth/logout') {
        await store.logout(token, browser);
        response.setHeader('Set-Cookie', [cookie(name, '', 0), cookie(preauth, '', 0)]); send(200, { ok: true }); return;
      }
      if (request.url === '/api/auth/challenge') {
        if (body.networkId !== networkId || !bindings.some(b => b.partyId === body.partyId && b.networkId === networkId)) { send(403, { error: 'Identity is not enabled for this application' }); return; }
        const challenge = createAuthenticationChallenge({ origin, networkId, partyId: body.partyId, nonce: random() });
        const binding = random(); await store.insert(challenge, binding);
        response.setHeader('Set-Cookie', cookie(preauth, binding, 600)); send(200, challenge); return;
      }
      if (!browser) { send(401, { error: 'Sign-in failed' }); return; }
      try {
        const identity = await verifyAuthenticationProof({ origin, networkId, proof: { nonce: body.nonce, signature: body.signature },
          consumeChallenge: async nonce => store.consume(nonce, browser), verifySignatureAndParty });
        const next = random(); await store.establish(next, identity, token, browser);
        response.setHeader('Set-Cookie', [cookie(name, next, 3600), cookie(preauth, '', 0)]); send(200, identity);
      } catch { send(401, { error: 'Sign-in failed' }); }
    } catch { if (!response.headersSent) send(400, { error: 'Invalid request' }); else response.end(); }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { APP_ORIGIN, CANTON_NETWORK_ID, TRUSTED_PARTY_KEYS_FILE, DATABASE_URL, PORT = '3190',
    LEDGER_URL, LEDGER_BEARER_TOKEN, HOLDING_INTERFACE_ID, LEDGER_SOURCE_ID } = process.env;
  if (!APP_ORIGIN || !CANTON_NETWORK_ID || !TRUSTED_PARTY_KEYS_FILE || !DATABASE_URL) throw new Error('Configure APP_ORIGIN, CANTON_NETWORK_ID, TRUSTED_PARTY_KEYS_FILE and DATABASE_URL');
  const bindings = JSON.parse(readFileSync(TRUSTED_PARTY_KEYS_FILE, 'utf8'));
  const database = new Pool({ connectionString: DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  const ledger = [LEDGER_URL, LEDGER_BEARER_TOKEN, HOLDING_INTERFACE_ID, LEDGER_SOURCE_ID].some(Boolean)
    ? { url: LEDGER_URL, bearerToken: LEDGER_BEARER_TOKEN, holdingInterfaceId: HOLDING_INTERFACE_ID, sourceId: LEDGER_SOURCE_ID } : undefined;
  const server = await createAuthenticationServer({ origin: APP_ORIGIN, networkId: CANTON_NETWORK_ID, bindings, database, ledger });
  server.on('close', () => { void database.end(); });
  server.listen(Number(PORT), '127.0.0.1', () => { console.log(`PartyLayer authentication reference listening on 127.0.0.1:${PORT}`); });
}
