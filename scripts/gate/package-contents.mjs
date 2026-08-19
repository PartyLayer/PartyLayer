#!/usr/bin/env node
/**
 * Regression gate: what each publishable package actually ships.
 *
 * A tarball is the only artifact a consumer ever sees, and it is the one thing that cannot
 * be corrected after a publish. Two defects reached the registry without anything catching
 * them: a package whose `exports` map named `./dist/index.mjs` while its build never emitted
 * that file, so the package could not be imported at all, and a package with no `files`
 * allowlist that shipped its `src`, its tests and its tsconfigs.
 *
 * Neither is visible in source review, and neither is visible in a build: they only appear
 * once the package is packed. So this packs every publishable package and asserts, per
 * package:
 *
 *   1. every target named in `exports`, `main`, `module`, `types` and `bin` exists in the
 *      tarball, so nothing points at a file that was never emitted;
 *   2. LICENSE and README.md are present;
 *   3. no `src/`, no test files, no tsconfig and no tsbuildinfo are included.
 *
 * It packs with `pnpm pack`, not `npm pack`, because pnpm rewrites the `workspace:` protocol
 * into the range that will really be published. An npm-packed tarball would misrepresent
 * the artifact.
 *
 * It runs `copy-license` first. `packages/*​/LICENSE` is generated and gitignored, so on a
 * fresh checkout it does not exist yet and every package would fail item 2 for the wrong
 * reason. Running it here makes the gate self-contained.
 *
 * Requires a build first, since it inspects `dist`. `pnpm gate` runs `gate:build` before
 * this. Run via `pnpm gate:package-contents`.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readdirSync, existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

/** Files a published tarball must never contain. */
const FORBIDDEN = [
  { label: 'source', test: (f) => f.startsWith('src/') },
  { label: 'tests', test: (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) },
  { label: 'tsconfig', test: (f) => /(^|\/)tsconfig[^/]*\.json$/.test(f) },
  { label: 'tsbuildinfo', test: (f) => f.endsWith('.tsbuildinfo') },
];

function publishablePackages() {
  const out = [];
  for (const base of ['packages', 'packages/adapters', 'apps', 'examples']) {
    const dir = join(repoRoot, base);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const manifest = join(dir, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.private === true) continue;
      out.push({ name: pkg.name, dir: join(dir, entry) });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every path a consumer can be routed to by the manifest. */
function declaredTargets(pkg) {
  const targets = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value.startsWith('.')) targets.add(value.replace(/^\.\//, ''));
  };
  const walk = (node) => {
    if (typeof node === 'string') return add(node);
    if (node && typeof node === 'object') for (const value of Object.values(node)) walk(value);
  };
  walk(pkg.exports);
  for (const field of ['main', 'module', 'types', 'typings']) add(pkg[field]);
  if (typeof pkg.bin === 'string') add(pkg.bin);
  else if (pkg.bin) for (const value of Object.values(pkg.bin)) add(value);
  return [...targets];
}

// LICENSE is generated and gitignored, so make sure it exists before judging its absence.
execFileSync('node', [join(repoRoot, 'scripts', 'copy-license.mjs')], { cwd: repoRoot, stdio: 'pipe' });

const staging = mkdtempSync(join(tmpdir(), 'pl-pack-'));
let failed = 0;
const rows = [];

try {
  for (const { name, dir } of publishablePackages()) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    let tarball;
    try {
      const out = execFileSync('pnpm', ['pack', '--pack-destination', staging], {
        cwd: dir,
        encoding: 'utf8',
      });
      tarball = out.trim().split('\n').filter(Boolean).pop();
    } catch (error) {
      console.error(`X ${name}: pnpm pack failed. ${error instanceof Error ? error.message : error}`);
      failed++;
      continue;
    }

    const listed = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.replace(/^package\//, '').trim())
      .filter((line) => line && !line.endsWith('/'));
    const files = new Set(listed);

    const problems = [];

    // A package may deliberately ship a payload directory that is not `dist`, declared in
    // its `files` allowlist. create-partylayer-app ships `templates`, and a scaffolded app
    // needs its own tsconfig, so those are intentional rather than leaked build files. The
    // forbidden rules below therefore apply only OUTSIDE such a declared directory. The
    // target, LICENSE and README rules still apply to everything.
    const payloadPrefixes = (Array.isArray(pkg.files) ? pkg.files : [])
      .filter((entry) => typeof entry === 'string' && entry !== 'dist' && !entry.includes('.'))
      .map((entry) => entry.replace(/^\.?\//, '').replace(/\/$/, '') + '/');
    const isPayload = (file) => payloadPrefixes.some((prefix) => file.startsWith(prefix));

    const missing = declaredTargets(pkg).filter((target) => !files.has(target));
    if (missing.length > 0) {
      problems.push(
        `names ${missing.join(', ')} in its manifest, but the tarball has no such file. ` +
          `A consumer resolving that entry gets ERR_MODULE_NOT_FOUND.`,
      );
    }

    if (!files.has('LICENSE')) problems.push('ships no LICENSE.');
    if (!files.has('README.md')) problems.push('ships no README.md.');

    for (const { label, test } of FORBIDDEN) {
      const hits = listed.filter((file) => !isPayload(file) && test(file));
      if (hits.length > 0) {
        problems.push(
          `ships ${hits.length} ${label} file(s) that belong only in the repository: ` +
            `${hits.slice(0, 6).join(', ')}${hits.length > 6 ? ', ...' : ''}. ` +
            `Add a "files" allowlist to its package.json.`,
        );
      }
    }

    rows.push({ name, count: listed.length, ok: problems.length === 0 });
    if (problems.length > 0) {
      failed++;
      console.error(`\nX ${name}@${pkg.version}`);
      for (const problem of problems) console.error(`    ${problem}`);
    }
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}

console.log('\nPackage contents:');
for (const row of rows) {
  console.log(`  ${row.ok ? 'OK  ' : 'FAIL'} ${row.name.padEnd(36)} ${row.count} files`);
}

if (failed > 0) {
  console.error(`\nX Package-contents check FAILED for ${failed} package(s). See above.`);
  process.exit(1);
}

console.log(`\nOK Package-contents check PASSED for ${rows.length} package(s).`);
