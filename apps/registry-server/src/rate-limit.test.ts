import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createRegistryRateLimit } from './rate-limit.js';

test('registry file requests are limited before reaching their handler', async () => {
  const app = express(); let reads = 0;
  app.use(createRegistryRateLimit(2));
  app.get('/v1/stable/registry.json', (_req, res) => { reads++; res.json({ wallets: [] }); });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/v1/stable/registry.json`;
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 200);
    const denied = await fetch(url); assert.equal(denied.status, 429);
    assert.ok(denied.headers.get('retry-after')); assert.equal(reads, 2);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
