#!/usr/bin/env node
/**
 * copy-license.mjs
 *
 * Copies the repository root LICENSE into every publishable workspace package so the
 * published tarball ships it. npm always includes a LICENSE file that sits in the
 * package directory, even when the package narrows "files" to dist, so placing the file
 * there is enough for it to appear in the tarball and on the npm page.
 *
 * This runs as a prepublish step from the root "release" script, just before
 * `changeset publish`, and can be run on its own with `pnpm license:copy` (for example
 * to verify with `npm pack --dry-run`). It is idempotent: it overwrites any existing
 * copy so a stale LICENSE cannot linger. Private packages (private: true) are skipped,
 * since they are never published. The copies are git ignored (see .gitignore); they are
 * build-time artifacts, not tracked sources.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LICENSE = join(ROOT, 'LICENSE');

if (!existsSync(LICENSE)) {
  console.error('copy-license: no LICENSE at repo root:', LICENSE);
  process.exit(1);
}
const text = readFileSync(LICENSE, 'utf8');

// Directories that hold publishable packages, one level down from each container.
const CONTAINERS = [join(ROOT, 'packages'), join(ROOT, 'packages', 'adapters')];

const copied = [];
const skipped = [];
for (const container of CONTAINERS) {
  if (!existsSync(container)) continue;
  for (const name of readdirSync(container)) {
    const dir = join(container, name);
    if (!statSync(dir).isDirectory()) continue;
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) continue; // e.g. the adapters/ container itself
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      continue;
    }
    if (pkg.private === true) {
      skipped.push(pkg.name ?? name);
      continue;
    }
    writeFileSync(join(dir, 'LICENSE'), text);
    copied.push(pkg.name ?? name);
  }
}

console.log(`copy-license: wrote LICENSE into ${copied.length} package(s): ${copied.sort().join(', ')}`);
if (skipped.length) {
  console.log(`copy-license: skipped ${skipped.length} private package(s): ${skipped.sort().join(', ')}`);
}
