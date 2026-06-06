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
  stable: ['console', 'send'],
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

// ─── Run ─────────────────────────────────────────────────────────────────────

let failed = false;

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
}

if (failed) {
  console.error('\n✗ Registry integrity check FAILED.');
  process.exit(1);
}

console.log('\n✓ Registry integrity check PASSED.');
