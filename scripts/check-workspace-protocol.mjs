#!/usr/bin/env node
/**
 * Guardrail: ensure every package.json uses `workspace:^` (or explicit ranges)
 * for @partylayer/* dependencies — never `workspace:*`.
 *
 * Why: pnpm converts `workspace:*` to an exact version pin at publish time.
 * When a consumer upgrades one package (e.g. @partylayer/sdk) but another
 * published package (e.g. @partylayer/react) pins the OLD exact version,
 * npm keeps both copies → duplicate type identities → TS2322 errors like:
 *   "Type 'CantonConnectClient' is not assignable to type 'CantonConnectClient'."
 *
 * `workspace:^` becomes `^x.y.z` at publish time, allowing compatible updates
 * and proper deduplication.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'coverage']);

function findPackageJsons(dir, results = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) findPackageJsons(full, results);
    } else if (entry === 'package.json') {
      results.push(full);
    }
  }
  return results;
}

const files = findPackageJsons(ROOT);

const failures = [];
for (const file of files) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[section] || {};
    for (const [name, version] of Object.entries(deps)) {
      if (version === 'workspace:*') {
        failures.push(
          `${relative(ROOT, file)}: ${section}.${name} uses "workspace:*" — must be "workspace:^"`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Workspace protocol violations:\n');
  failures.forEach((f) => console.error('  ' + f));
  console.error(
    `\n${failures.length} violation(s). Change "workspace:*" to "workspace:^" — see scripts/check-workspace-protocol.mjs header for context.`,
  );
  process.exit(1);
}

console.log(`All workspace protocols correct (${files.length} package.json files scanned).`);
