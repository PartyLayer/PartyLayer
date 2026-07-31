/**
 * Seed the DvP demo with a few small, real trades against the LIVE DevNet gateway.
 *
 * A fresh deployment lands on an empty Trades list until the venue creates one, which
 * reads poorly for a first visitor. This script asks the live gateway to create N small
 * trades so the deployed demo shows real, settleable activity on first load.
 *
 * SAFETY: it refuses to run without the literal --yes flag, and it refuses to run unless GET
 * /health reports mode "live", so it can never touch a mock or misconfigured gateway by
 * accident. It is a deploy-time step only, never wired into CI or the build (no package.json
 * references it). See DEPLOY.md, "DvP seed (deploy-time step)".
 *
 * Usage:
 *   GATEWAY_URL=https://gateway.example node scripts/seed-dvp.mjs --yes [count]
 *   GATEWAY_URL=https://gateway.example SEED_COUNT=5 node scripts/seed-dvp.mjs --yes
 *
 * Flags and env:
 *   --yes         required, explicit confirmation that this writes real trades to the ledger
 *   GATEWAY_URL   required, the live gateway base url (a trailing slash is trimmed)
 *   SEED_COUNT    optional, number of trades to create (default 3, clamped to 1..10)
 *
 * The host running this must be allowed to reach the gateway directly (for example the
 * deploy box), since the live gateway is network gated rather than token authenticated.
 */

const rawUrl = process.env.GATEWAY_URL;
if (!rawUrl) {
  console.error(
    'GATEWAY_URL is required, e.g. GATEWAY_URL=https://gateway.example node scripts/seed-dvp.mjs --yes',
  );
  process.exit(1);
}
const baseUrl = rawUrl.replace(/\/+$/, '');

// Explicit confirmation gate: this writes real trades to a live ledger, so it refuses to run
// unless the literal --yes flag is present. The health and mode-live checks below still apply.
if (!process.argv.includes('--yes')) {
  console.error(
    'Refusing to seed without confirmation. This creates real trades on the live gateway. ' +
      'Re-run with the --yes flag, e.g. GATEWAY_URL=https://gateway.example node scripts/seed-dvp.mjs --yes',
  );
  process.exit(1);
}

// Count comes from the first positional argument (a bare number), so flags like --yes are
// ignored, or from SEED_COUNT, defaulting to 3 and clamped to 1..10.
const positional = process.argv.slice(2).find((a) => !a.startsWith('--'));
const requested = Number.parseInt(positional ?? process.env.SEED_COUNT ?? '3', 10);
const count = Number.isFinite(requested) ? Math.max(1, Math.min(10, requested)) : 3;

const headers = { 'content-type': 'application/json' };

// Small, distinct amounts so the seeded trades are cheap and easy to tell apart.
function amountsFor(i) {
  return { usdAmount: (10 + i).toFixed(2), bondAmount: (1 + i).toFixed(2) };
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// SAFETY GATE: only ever run against a gateway that reports live mode.
let healthRes;
try {
  healthRes = await fetch(baseUrl + '/health', { headers });
} catch (err) {
  console.error('Could not reach ' + baseUrl + '/health: ' + err.message);
  process.exit(1);
}
if (!healthRes.ok) {
  console.error('Health check returned HTTP ' + healthRes.status + '. Refusing to seed.');
  process.exit(1);
}
const health = await readJson(healthRes);
if (!health || health.mode !== 'live') {
  const seen = health ? JSON.stringify(health.mode) : 'unknown';
  console.error('Gateway mode is ' + seen + ', not "live". Refusing to seed a non-live gateway.');
  process.exit(1);
}
console.log('Gateway at ' + baseUrl + ' reports mode live. Seeding ' + count + ' trade(s).');

let created = 0;
for (let i = 0; i < count; i++) {
  const vars = amountsFor(i);
  let res;
  try {
    res = await fetch(baseUrl + '/dvp/createTrade', {
      method: 'POST',
      headers,
      body: JSON.stringify({ vars }),
    });
  } catch (err) {
    console.error('Trade ' + (i + 1) + ' request failed: ' + err.message);
    break;
  }
  const body = await readJson(res);
  if (!res.ok) {
    console.error(
      'Trade ' + (i + 1) + ' rejected with HTTP ' + res.status + ': ' + (body ? JSON.stringify(body) : '(no body)'),
    );
    break;
  }
  created++;
  console.log('  created trade ' + created + '/' + count + ' usd ' + vars.usdAmount + ' bond ' + vars.bondAmount);
}

if (created === count) {
  console.log('Done. Seeded ' + created + ' trade(s).');
} else {
  console.error('Stopped after ' + created + ' of ' + count + ' trade(s). See the error above.');
  process.exit(1);
}
