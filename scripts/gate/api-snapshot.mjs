#!/usr/bin/env node
/**
 * Regression gate — public-API + packaging-surface snapshots & diff.
 *
 * For every CURRENTLY PUBLISHED package that exposes a type entry point, this
 * captures TWO committed snapshots and diffs both on every gate run:
 *
 *   1. tooling/api-snapshots/<pkg>.api.d.ts  — the package's public TYPE
 *      surface (the .d.ts it publishes via package.json "types"/"exports"),
 *      normalized through Prettier so cosmetic ordering/whitespace can never
 *      cause a false gate failure.
 *
 *   2. tooling/api-snapshots/<pkg>.pkg.json  — the package's PACKAGING
 *      surface: a normalized JSON of { name, main, module, types, exports,
 *      bin, peerDependencies } (version intentionally EXCLUDED). A
 *      peerDependencies range change or a removed exports subpath breaks
 *      consumers but never shows up in the .d.ts rollup — this catches it.
 *
 * ANY change to either snapshot fails the gate. That is the point: it makes
 * silent breakage of the public API OR the packaging contract impossible
 * while we evolve the SDK.
 *
 * Approach — d.ts rollup (NOT Microsoft API Extractor):
 *   The @partylayer/* packages build with tsup, which already emits a single
 *   bundled dist/index.d.ts containing the FULL public type surface. That
 *   bundled file IS the published contract, so snapshotting it (Prettier-
 *   normalized) is both faithful and deterministic — no extra heavy tooling.
 *
 * Snapshot set is AUTO-DISCOVERED: every workspace package with
 * "private": false AND a "types" entry point, minus EXCLUDED_PACKAGES below.
 * New publishable packages (e.g. @partylayer/session, @partylayer/testing)
 * are picked up automatically once published.
 *
 * Usage:
 *   node scripts/gate/api-snapshot.mjs            # check (default) — diffs, exits 1 on change
 *   node scripts/gate/api-snapshot.mjs --update   # rewrite snapshots intentionally
 *   pnpm gate:api            # check
 *   pnpm gate:api:update     # update
 *
 * Requires a fresh `pnpm build` first so dist/*.d.ts exist (`pnpm gate`
 * builds before calling this).
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const snapshotDir = resolve(repoRoot, 'tooling', 'api-snapshots');
const require = createRequire(import.meta.url);

const UPDATE = process.argv.includes('--update');

// ─── Excluded packages ───────────────────────────────────────────────────────
// Packages deliberately kept OUT of the API gate.
//
//   @partylayer/adapter-starter — a copy-me template, not a runtime
//     dependency of any dApp. It builds with `tsc` (not tsup), so its
//     index.d.ts only RE-EXPORTS from sibling files rather than inlining the
//     full surface. Snapshotting it would be half-protection (entry file
//     only) and a source of false failures, so it is excluded entirely.
const EXCLUDED_PACKAGES = new Set(['@partylayer/adapter-starter']);

// ─── Prettier (deterministic .d.ts normalization) ────────────────────────────

let prettier;
try {
  prettier = require('prettier');
} catch {
  console.error(
    '✗ `prettier` is not installed. Run `pnpm install` (it is a root devDependency).',
  );
  process.exit(1);
}
const prettierConfig =
  (await prettier.resolveConfig(resolve(repoRoot, '.prettierrc'))) ?? {};

async function normalizeDts(raw) {
  return prettier.format(raw, { ...prettierConfig, parser: 'typescript' });
}

// ─── Discover published packages with a public type entry point ──────────────

/** Directories that contain workspace packages (non-recursive globs). */
const packageGlobs = [
  resolve(repoRoot, 'packages'),
  resolve(repoRoot, 'packages', 'adapters'),
];

function discoverPackages() {
  const pkgs = [];
  for (const base of packageGlobs) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgJsonPath = join(base, entry.name, 'package.json');
      if (!existsSync(pkgJsonPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.private) continue; // private packages are never published
      if (EXCLUDED_PACKAGES.has(pkg.name)) continue;
      // Enumerate EVERY exports-map entry point that exposes types (".",
      // "./query", …) so no public subpath surface lands ungated. Fall back to
      // the legacy top-level "types" field for packages without an exports map.
      const pkgDir = join(base, entry.name);
      const entryPoints = [];
      const exportsMap = pkg.exports && typeof pkg.exports === 'object' ? pkg.exports : null;
      if (exportsMap) {
        for (const [sub, val] of Object.entries(exportsMap)) {
          const typesRel = val && typeof val === 'object' ? val.types : undefined;
          if (!typesRel) continue;
          const name = sub === '.' ? pkg.name : `${pkg.name}/${sub.replace(/^\.\//, '')}`;
          entryPoints.push({ name, typesPath: join(pkgDir, typesRel) });
        }
      }
      if (entryPoints.length === 0 && pkg.types) {
        entryPoints.push({ name: pkg.name, typesPath: join(pkgDir, pkg.types) });
      }
      if (entryPoints.length === 0) continue; // CLIs (registry-cli, conformance-runner) — no type surface
      pkgs.push({ name: pkg.name, json: pkg, dir: pkgDir, entryPoints });
    }
  }
  // Deterministic ordering.
  pkgs.sort((a, b) => a.name.localeCompare(b.name));
  return pkgs;
}

/** @partylayer/core -> partylayer__core ; @partylayer/testing/query -> partylayer__testing__query */
function sanitize(name) {
  return name.replace('@', '').replace(/\//g, '__');
}
function dtsSnapshotFor(name) {
  return join(snapshotDir, `${sanitize(name)}.api.d.ts`);
}
function pkgSnapshotFor(name) {
  return join(snapshotDir, `${sanitize(name)}.pkg.json`);
}

// ─── Packaging-surface normalization ─────────────────────────────────────────
// Selected fields only; version is intentionally EXCLUDED (it changes every
// release and is not part of the consumer contract). Keys are sorted
// recursively so a cosmetic reorder in package.json can't cause a false
// failure, while an added/removed export subpath or a changed peerDeps range
// still shows up as a real diff.
const PACKAGING_FIELDS = [
  'name',
  'main',
  'module',
  'types',
  'exports',
  'bin',
  'peerDependencies',
];

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stableSort(value[key]);
    return out;
  }
  return value;
}

function packagingSnapshot(pkgJson) {
  const picked = {};
  for (const field of PACKAGING_FIELDS) {
    if (pkgJson[field] !== undefined) picked[field] = pkgJson[field];
  }
  return JSON.stringify(stableSort(picked), null, 2) + '\n';
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const packages = discoverPackages();

if (packages.length === 0) {
  console.error('✗ No publishable packages with a type entry point were found.');
  process.exit(1);
}

mkdirSync(snapshotDir, { recursive: true });

const missingBuild = [];
const drifted = [];
let updated = 0;

let entryPointCount = 0;

for (const pkg of packages) {
  // ── Packaging surface (.pkg.json) — once per package ─────────────────────
  // The exports map (all subpaths) lives here, so a removed/changed subpath is
  // caught even before its per-entry-point .d.ts diff.
  const pkgBody = packagingSnapshot(pkg.json);
  const pkgSnap = pkgSnapshotFor(pkg.name);
  if (UPDATE) {
    writeFileSync(pkgSnap, pkgBody);
  } else if (!existsSync(pkgSnap)) {
    drifted.push({ pkg, kind: 'pkg', reason: 'no committed .pkg.json snapshot exists' });
  } else if (readFileSync(pkgSnap, 'utf-8') !== pkgBody) {
    drifted.push({ pkg, kind: 'pkg', reason: 'packaging surface differs from snapshot' });
  }

  // ── Public type surface (.d.ts) — once per EXPORTS ENTRY POINT ───────────
  for (const ep of pkg.entryPoints) {
    entryPointCount++;
    if (!existsSync(ep.typesPath)) {
      missingBuild.push(ep);
      continue;
    }
    const header =
      `// API SURFACE SNAPSHOT — ${ep.name}\n` +
      `// Generated by scripts/gate/api-snapshot.mjs from the package's published\n` +
      `// "types" entry point, normalized through Prettier. DO NOT edit by hand.\n` +
      `// To intentionally accept a public-API change, run: pnpm gate:api:update\n` +
      `// ----------------------------------------------------------------------------\n`;
    const dtsBody = header + (await normalizeDts(readFileSync(ep.typesPath, 'utf-8')));
    const dtsSnap = dtsSnapshotFor(ep.name);
    if (UPDATE) {
      writeFileSync(dtsSnap, dtsBody);
      continue;
    }
    if (!existsSync(dtsSnap)) {
      drifted.push({ pkg, ep, kind: 'type', reason: 'no committed .api.d.ts snapshot exists' });
    } else if (readFileSync(dtsSnap, 'utf-8') !== dtsBody) {
      drifted.push({ pkg, ep, kind: 'type', reason: 'public type surface differs from snapshot' });
    }
  }
}

if (missingBuild.length > 0) {
  console.error('✗ Missing built type entry points (run `pnpm build` first):');
  for (const ep of missingBuild) console.error(`    ${ep.name} → ${ep.typesPath}`);
  process.exit(1);
}

if (UPDATE) {
  console.log(
    `✓ Updated snapshots for ${packages.length} package(s) / ${entryPointCount} entry point(s) in tooling/api-snapshots/`,
  );
  for (const pkg of packages) {
    for (const ep of pkg.entryPoints) console.log(`    ${ep.name}`);
  }
  process.exit(0);
}

if (drifted.length > 0) {
  console.error('✗ Public surface changed:');
  for (const d of drifted) {
    const label = d.kind === 'type' ? `public API (${d.ep.name})` : 'packaging (package.json)';
    console.error(`    ${d.pkg.name} — ${label}: ${d.reason}`);
  }
  console.error('');
  console.error('  Review the diff(s):');
  for (const d of drifted) {
    if (d.kind === 'type') {
      console.error(
        `    diff <(tail -n +6 ${relativize(dtsSnapshotFor(d.ep.name))}) <(pnpm exec prettier --parser typescript ${relativize(d.ep.typesPath)})`,
      );
    } else {
      console.error(`    git diff ${relativize(pkgSnapshotFor(d.pkg.name))}`);
    }
  }
  console.error('');
  console.error('  If the change is INTENTIONAL, accept it with: pnpm gate:api:update');
  process.exit(1);
}

console.log(
  `✓ Public API + packaging surface unchanged across ${packages.length} package(s) / ${entryPointCount} entry point(s):`,
);
for (const pkg of packages) {
  for (const ep of pkg.entryPoints) console.log(`    ${ep.name}`);
}

function relativize(p) {
  return p.startsWith(repoRoot) ? p.slice(repoRoot.length + 1) : p;
}
