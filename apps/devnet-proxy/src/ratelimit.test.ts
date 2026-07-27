import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rateLimiter } from './ratelimit.js';

/** Start a tiny app with the limiter (max 3) and optional `trust proxy`, on an ephemeral port. */
function startApp(trustProxy: number | null): Promise<{ port: number; close: () => void }> {
  const app = express();
  if (trustProxy !== null) app.set('trust proxy', trustProxy);
  app.use(rateLimiter(60_000, 3));
  app.get('/', (_req, res) => res.json({ ok: true }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ port, close: () => server.close() });
    });
  });
}

/** All requests share one localhost socket; only the forwarded address varies. */
async function hit(port: number, forwardedFor: string): Promise<number> {
  const res = await fetch('http://127.0.0.1:' + port + '/', { headers: { 'x-forwarded-for': forwardedFor } });
  return res.status;
}

test('with trust proxy set, the limiter keys on the forwarded client, not the socket', async () => {
  const { port, close } = await startApp(1);
  try {
    // Client 1.1.1.1: three allowed, the fourth is limited.
    assert.equal(await hit(port, '1.1.1.1'), 200);
    assert.equal(await hit(port, '1.1.1.1'), 200);
    assert.equal(await hit(port, '1.1.1.1'), 200);
    assert.equal(await hit(port, '1.1.1.1'), 429);
    // A different forwarded client, same socket, gets its own bucket and is allowed.
    assert.equal(await hit(port, '2.2.2.2'), 200);
  } finally {
    close();
  }
});

test('without trust proxy, every forwarded client shares the one socket-keyed bucket', async () => {
  const { port, close } = await startApp(null);
  try {
    // Distinct forwarded addresses, but the key is the shared socket ip, so they add up.
    assert.equal(await hit(port, '1.1.1.1'), 200);
    assert.equal(await hit(port, '2.2.2.2'), 200);
    assert.equal(await hit(port, '3.3.3.3'), 200);
    assert.equal(await hit(port, '4.4.4.4'), 429);
  } finally {
    close();
  }
});
