#!/usr/bin/env node
/**
 * Pack LOCAL builds of the PartyLayer packages the demo consumes, into vendor/.
 *
 * The demo exists to exercise the packages BEFORE they are published, so it has to run
 * the working tree rather than whatever the registry serves. A local build and a
 * published release can carry the same version number, so a plain install would resolve
 * the registry copy. This packs the local builds and the demo forces every @partylayer
 * package to these tarballs through pnpm overrides, which makes the working tree the
 * thing under test. `verify-core.mjs` confirms the vendored copies are what resolved.
 * Run this before installing the demo.
 *
 *   node prepare-local.mjs   (or: pnpm run prepare-local)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const vendor = join(here, 'vendor');

// The full @partylayer runtime tree the react-native package pulls in.
const PACKAGES = [
  ['@partylayer/core', 'packages/core'],
  ['@partylayer/session', 'packages/session'],
  ['@partylayer/registry-client', 'packages/registry-client'],
  ['@partylayer/provider', 'packages/provider'],
  ['@partylayer/adapter-console', 'packages/adapters/console'],
  ['@partylayer/adapter-loop', 'packages/adapters/loop'],
  ['@partylayer/adapter-cantor8', 'packages/adapters/cantor8'],
  ['@partylayer/adapter-bron', 'packages/adapters/bron'],
  ['@partylayer/adapter-nightly', 'packages/adapters/nightly'],
  ['@partylayer/adapter-send', 'packages/adapters/send'],
  ['@partylayer/sdk', 'packages/sdk'],
  ['@partylayer/react-native', 'packages/react-native'],
];

/** vendor tarball name for a package (matches how the demo package.json references it). */
export function tarballName(pkgName) {
  return pkgName.replace('@', '').replace(/\//g, '-') + '.tgz';
}

rmSync(vendor, { recursive: true, force: true });
mkdirSync(vendor, { recursive: true });

console.log('Building the workspace packages...');
const filters = PACKAGES.map(([name]) => `--filter ${name}`).join(' ');
execSync(`pnpm ${filters} build`, { cwd: repoRoot, stdio: 'inherit' });

for (const [name, dir] of PACKAGES) {
  const pkgDir = join(repoRoot, dir);
  const prefix = name.replace('@', '').replace(/\//g, '-');
  console.log(`Packing ${name}...`);
  execSync(`pnpm pack --pack-destination "${vendor}"`, { cwd: pkgDir, stdio: 'inherit' });
  // Normalize the versioned tarball (prefix-<version>.tgz) to a stable, version-free
  // name the demo package.json references, so the demo does not track versions.
  const wanted = tarballName(name);
  const produced = readdirSync(vendor).find((f) => f.startsWith(`${prefix}-`) && f.endsWith('.tgz'));
  if (produced && produced !== wanted) renameSync(join(vendor, produced), join(vendor, wanted));
}

console.log('\nLocal tarballs ready in vendor/. Now run: pnpm install');
