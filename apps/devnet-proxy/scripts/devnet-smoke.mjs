#!/usr/bin/env node
/**
 * Read only smoke check for the gateway. Given the gateway url, it checks /health and
 * reads alice's holdings. It performs no mutation and needs no secret.
 *
 * Usage:
 *   GATEWAY_URL=http://localhost:8787 node scripts/devnet-smoke.mjs
 *   (defaults to http://localhost:$PORT or http://localhost:8787)
 */
const base = (process.env.GATEWAY_URL || 'http://localhost:' + (process.env.PORT || '8787')).replace(/\/$/, '');

async function main() {
  const health = await fetch(base + '/health').then((r) => r.json());
  console.log('health:', JSON.stringify(health));
  if (!health.ok) throw new Error('health not ok');

  const cfg = await fetch(base + '/config').then((r) => r.json());
  console.log('mode:', cfg.mode, 'parties:', JSON.stringify(cfg.parties));

  const holdings = await fetch(base + '/tokenization/holdings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ party: 'alice' }),
  }).then((r) => r.json());
  const count = Array.isArray(holdings) ? holdings.length : 0;
  console.log('alice holdings:', count, 'entries');
  console.log('smoke: OK');
}

main().catch((err) => {
  console.error('smoke: FAILED', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
