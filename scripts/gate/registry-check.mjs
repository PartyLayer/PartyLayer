#!/usr/bin/env node
/**
 * Regression gate — registry integrity check.
 *
 * Validates registry/v1/stable/registry.json and registry/v1/beta/registry.json:
 *
 *   1. SHAPE — against tooling/registry-schema/registry.schema.json (JSON
 *      Schema draft-07, via ajv). Confirms every wallet entry retains its
 *      required fields (id, name, supportedNetworks, capabilities, adapter…)
 *      and that optional structures (cip0103, providerDetection) are well
 *      formed WHEN present.
 *
 *   2. CIP-0103 FOOTGUN GUARD — asserts that wallets which are CIP-0103
 *      native KEEP their `cip0103.native: true` flag. A missing flag makes
 *      production fall back to GENERIC provider detection — a known footgun
 *      this gate exists to prevent. The expected set is explicit per channel
 *      (see REQUIRED_CIP0103_NATIVE below) and grows additively: when a new
 *      wallet is confirmed CIP-0103 native, add its id here in the same PR.
 *
 * This is a structural / required-field check, NOT a frozen-content diff —
 * registry content is expected to grow additively over time.
 *
 * Run via `pnpm gate:registry`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

// ─── Footgun guard: wallets that MUST stay CIP-0103 native, per channel ──────
// This allowlist guards against accidental REMOVAL of existing cip0103.native
// flags. Current: stable={console,send}, beta={console}. When a wallet is
// verified native during the adapter-sunset work, ADD it here — this list
// grows additively. (Add the id in the SAME PR that marks the wallet
// cip0103.native in the registry JSON; removing a flag without removing it
// here fails the gate, which is the intended behaviour.)
const REQUIRED_CIP0103_NATIVE = {
  stable: ['console', 'send', 'walley'],
  beta: ['console'],
};

const channels = [
  {
    channel: 'stable',
    path: resolve(repoRoot, 'registry/v1/stable/registry.json'),
  },
  {
    channel: 'beta',
    path: resolve(repoRoot, 'registry/v1/beta/registry.json'),
  },
];

const schemaPath = resolve(
  repoRoot,
  'tooling/registry-schema/registry.schema.json',
);

// ─── Load ajv ─────────────────────────────────────────────────────────────────

let Ajv;
try {
  Ajv = require('ajv');
  // ajv v8 default export interop
  if (Ajv && Ajv.default) Ajv = Ajv.default;
} catch {
  console.error(
    '✗ `ajv` is not installed. Run `pnpm install` (it is a root devDependency).',
  );
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const validate = ajv.compile(schema);

// Deep structural diff: returns the list of field paths where `a` and `b` differ
// (scalars by value, arrays element-wise, objects by key). Used to name exactly
// which fields drifted between a wallet's stable and beta entries.
function deepDiffPaths(a, b, prefix = '') {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const paths = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      paths.push(...deepDiffPaths(a[k], b[k], prefix ? `${prefix}.${k}` : k));
    }
    return paths;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const paths = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      paths.push(...deepDiffPaths(a[i], b[i], `${prefix}[${i}]`));
    }
    return paths;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [prefix || '(root)'];
}

// ─── Run ─────────────────────────────────────────────────────────────────────

let failed = false;
// Wallet entries (id -> entry) per channel, collected below and compared after
// the loop so the beta channel can be asserted a true superset of stable: every
// stable id present in beta (presence) AND every shared entry deeply equal
// (content).
const walletEntriesByChannel = {};

for (const { channel, path } of channels) {
  if (!existsSync(path)) {
    console.error(`✗ [${channel}] registry file not found: ${path}`);
    failed = true;
    continue;
  }

  let registry;
  try {
    registry = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`✗ [${channel}] invalid JSON: ${String(err)}`);
    failed = true;
    continue;
  }

  // 1. Schema validation
  if (!validate(registry)) {
    failed = true;
    console.error(`✗ [${channel}] failed schema validation:`);
    for (const e of validate.errors ?? []) {
      console.error(`    ${e.instancePath || '(root)'} ${e.message}`);
    }
  } else {
    console.log(
      `✓ [${channel}] schema OK — ${registry.wallets.length} wallet(s), sequence ${registry.metadata.sequence}`,
    );
  }

  // Build id -> entry map (and check id uniqueness while we're here).
  const byId = new Map();
  for (const w of registry.wallets ?? []) {
    if (byId.has(w.id)) {
      console.error(`✗ [${channel}] duplicate wallet id: ${w.id}`);
      failed = true;
    }
    byId.set(w.id, w);
  }
  walletEntriesByChannel[channel] = byId;

  // 2. CIP-0103 footgun guard
  const required = REQUIRED_CIP0103_NATIVE[channel] ?? [];
  for (const id of required) {
    const entry = byId.get(id);
    if (!entry) {
      console.error(
        `✗ [${channel}] expected CIP-0103-native wallet "${id}" is missing from the registry.`,
      );
      failed = true;
      continue;
    }
    if (entry.cip0103?.native !== true) {
      console.error(
        `✗ [${channel}] wallet "${id}" lost its cip0103.native flag — ` +
          `production would fall back to GENERIC detection. ` +
          `Restore "cip0103": { "native": true, ... } on this entry.`,
      );
      failed = true;
    } else {
      console.log(`✓ [${channel}] "${id}" retains cip0103.native: true`);
    }
  }

  // 3. provider.id DISJOINTNESS (A2 systemic guard).
  // The identity bridge maps an announced `provider.id` to exactly one wallet.
  // If two wallets claim the same `provider.id`, an announce could route to the
  // wrong wallet (the original Send↔Console swap: Send's matcher held Console's
  // id `lpnf…`). Enforce that every wallet's `providerDetection` provider.id
  // value set is pairwise DISJOINT across the channel — permanently.
  const providerIdOwners = new Map(); // provider.id -> wallet id
  for (const w of registry.wallets ?? []) {
    for (const m of w.providerDetection?.matchers ?? []) {
      if (m.field !== 'provider.id' || m.match !== 'exact') continue;
      for (const value of m.values ?? []) {
        const owner = providerIdOwners.get(value);
        if (owner && owner !== w.id) {
          console.error(
            `✗ [${channel}] provider.id "${value}" is claimed by BOTH "${owner}" ` +
              `and "${w.id}" — provider.id sets must be disjoint (announce routing ` +
              `would be ambiguous). This is the Send↔Console swap class.`,
          );
          failed = true;
        } else {
          providerIdOwners.set(value, w.id);
        }
      }
    }
  }
  if (!failed) {
    console.log(`✓ [${channel}] provider.id ownership is pairwise disjoint`);
  }
}

// 4. CHANNEL SUPERSET: presence AND content. The beta channel must be a true
// superset of stable, which means two things:
//   (a) PRESENCE: every wallet id in stable also exists in beta, so a dApp that
//       switches to beta never silently loses a wallet it had on stable.
//   (b) CONTENT: for every wallet id present in BOTH channels, the entries are
//       deeply equal. Two channels listing the same wallet must describe the SAME
//       wallet; the only legitimate difference between channels is presence, not
//       content. A drifted field (e.g. a stale beta entry missing
//       adapter.transport) makes the wallet behave differently per channel, the
//       class of bug that dropped Console from a beta surface. An id-only check
//       misses this, so the content half is asserted field-by-field.
if (walletEntriesByChannel.stable && walletEntriesByChannel.beta) {
  const stable = walletEntriesByChannel.stable;
  const beta = walletEntriesByChannel.beta;
  const stableIds = [...stable.keys()];

  const missing = stableIds.filter((id) => !beta.has(id));
  if (missing.length > 0) {
    console.error(
      `✗ beta is not a superset of stable: [${missing.join(', ')}] exist in stable but ` +
        `not in beta. Copy each stable-only entry into beta byte-identical so a channel ` +
        `switch never drops a wallet stable offered.`,
    );
    failed = true;
  } else {
    console.log('✓ beta is a superset of stable (every stable wallet id exists in beta)');
  }

  let drift = false;
  for (const id of stableIds) {
    if (!beta.has(id)) continue; // presence already reported above
    const paths = deepDiffPaths(stable.get(id), beta.get(id));
    if (paths.length > 0) {
      console.error(
        `✗ wallet "${id}" is not identical across channels, differs at: ${paths.join(', ')}. ` +
          `Shared entries must be deeply equal (channels differ by presence, not content). ` +
          `Make the beta entry byte-identical to stable.`,
      );
      failed = true;
      drift = true;
    }
  }
  if (!drift) {
    console.log('✓ every wallet shared by stable and beta is byte-identical across channels');
  }
}

if (failed) {
  console.error('\n✗ Registry integrity check FAILED.');
  process.exit(1);
}

console.log('\n✓ Registry integrity check PASSED.');
