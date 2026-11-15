#!/usr/bin/env node
/**
 * Regression gate — public-API + packaging-surface snapshots & diff.
 *
 * For every CURRENTLY PUBLISHED package that exposes a type entry point, this
 * captures TWO committed snapshots and diffs both on every gate run:
 *
 *   1. tooling/api-snapshots/<pkg>.api.d.ts  — the package's public TYPE
 *      surface (the .d.ts it publishes via package.json "types"/"exports"),
 *      normalized through the TypeScript AST so cosmetic comments, formatting
 *      and top-level declaration ordering do not cause false gate failures.
 *
 *   2. tooling/api-snapshots/<pkg>.pkg.json  — the package's PACKAGING
 *      surface: a normalized JSON of { name, main, module, types, exports, imports,
 *      bin, peerDependencies, peerDependenciesMeta } (version intentionally EXCLUDED). A
 *      peerDependencies range change or a removed exports subpath breaks
 *      consumers but never shows up in the .d.ts rollup — this catches it.
 *
 * ANY change to either snapshot fails the gate. That is the point: it makes
 * silent breakage of the public API OR the packaging contract impossible
 * while we evolve the SDK.
 *
 * Approach — declaration closure (NOT Microsoft API Extractor):
 *   tsup can move public declarations into shared local chunks. Follow relative
 *   declaration imports/re-exports recursively and snapshot each reachable file
 *   through the existing AST canonical. External packages remain references.
 *   Export/import condition order stays visible because it affects Node routing.
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
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from 'node:fs';
import { buildHeader, snapshotBody } from './api-normalize.mjs';
import { declarationCanonical } from './api-declarations.mjs';
import { packagingSnapshot } from './api-packaging.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const snapshotDir = resolve(repoRoot, 'tooling', 'api-snapshots');

const UPDATE = process.argv.includes('--update');

// ─── Excluded packages ───────────────────────────────────────────────────────
// Packages deliberately kept OUT of the API gate.
//
//   @partylayer/adapter-starter — a copy-me template, not a runtime
//     dependency of any dApp. Its exclusion is an intentional package policy;
//     local declaration re-exports are supported by the closure collector.
const EXCLUDED_PACKAGES = new Set(['@partylayer/adapter-starter']);

// .d.ts normalization is AST-based (see ./api-normalize.mjs) — environment-stable,
// comment/format/order-immune, yet flags any real type-surface change.

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
    let canonical;
    try { canonical = declarationCanonical(ep.typesPath); }
    catch (error) {
      missingBuild.push({ ...ep, typesPath: `${ep.typesPath} (${error.message})` });
      continue;
    }
    const dtsBody = buildHeader(ep.name) + canonical;
    const dtsSnap = dtsSnapshotFor(ep.name);
    if (UPDATE) {
      writeFileSync(dtsSnap, dtsBody);
      continue;
    }
    if (!existsSync(dtsSnap)) {
      drifted.push({ pkg, ep, kind: 'type', reason: 'no committed .api.d.ts snapshot exists' });
      // Compare only the CANONICAL body — the header (incl. the TS version stamp)
      // is informational, so a TS patch that doesn't change the canonical never
      // false-drifts; a TS-driven canonical change is diagnosable from the stamp.
    } else if (snapshotBody(readFileSync(dtsSnap, 'utf-8')) !== canonical) {
      drifted.push({ pkg, ep, kind: 'type', reason: 'public type surface differs from snapshot' });
    }
  }
}

if (missingBuild.length > 0) {
  console.error('✗ Missing built type declarations (run `pnpm build` first):');
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
  console.error('  Review the diff(s) — regenerate then inspect with git:');
  console.error('    pnpm gate:api:update');
  for (const d of drifted) {
    const snap = d.kind === 'type' ? dtsSnapshotFor(d.ep.name) : pkgSnapshotFor(d.pkg.name);
    console.error(`    git --no-pager diff ${relativize(snap)}`);
  }
  console.error('');
  console.error('  If the change is INTENTIONAL, accept it (after reviewing): pnpm gate:api:update');
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
