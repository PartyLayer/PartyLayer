#!/usr/bin/env node
/**
 * Regression gate: scaffold-template version freshness.
 *
 * `create-partylayer-app` ships starter templates (react-vite, next-ssr,
 * vue-nuxt-pinia, vanilla). Each template's _package.json pins the `@partylayer/*`
 * packages a scaffolded app installs. Those pins silently rotted once already:
 * they were left at `@partylayer/react ^0.9.1` / `@partylayer/vue ^0.1.3` /
 * `@partylayer/sdk ^0.10.0` while the packages went to react 2.x / vue 1.x /
 * sdk 0.14.x, so `npm create partylayer-app` scaffolded users a major (or, for
 * 0.x packages where a minor is breaking, a breaking minor) behind, on a surface
 * that diverged from every current doc.
 *
 * This guard compares each template's `@partylayer/*` range against the CURRENT
 * workspace version of that package (the source of truth: the version that will
 * be published next). It FAILS when a template's range cannot resolve to the
 * current workspace version, which is exactly the rot above: a range like
 * `^0.9.1` cannot satisfy `2.0.0`, and `^0.10.0` cannot satisfy `0.14.1`.
 *
 * The next time `@partylayer/react` (or any of them) gets a major bump, this gate
 * fails until the templates are bumped in the same change. See docs/releasing.md.
 *
 * Run via `pnpm gate:templates`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { workspaceVersions as readWorkspaceVersions } from './workspace-versions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

let semver;
try {
  semver = require('semver');
} catch {
  console.error(
    'X `semver` is not installed. Run `pnpm install` (it is a root devDependency).',
  );
  process.exit(1);
}

// pnpm defines workspace membership. A recursive filesystem walk also sees
// .next/standalone copies and can overwrite current versions with stale builds.
function collectWorkspaceVersions() {
  return readWorkspaceVersions(repoRoot);
}

const TEMPLATES_DIR = join(repoRoot, 'packages', 'create-partylayer-app', 'templates');

const workspaceVersions = collectWorkspaceVersions();
if (workspaceVersions.size === 0) {
  console.error('X Could not read any workspace @partylayer/* package versions. Aborting.');
  process.exit(1);
}

if (!existsSync(TEMPLATES_DIR)) {
  console.error(`X Templates directory not found: ${TEMPLATES_DIR}`);
  process.exit(1);
}

const templates = readdirSync(TEMPLATES_DIR).filter((name) => {
  const p = join(TEMPLATES_DIR, name, '_package.json');
  return existsSync(p);
});

let failed = false;

for (const template of templates) {
  const manifestPath = join(TEMPLATES_DIR, template, '_package.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    console.error(`X [${template}] could not parse _package.json: ${String(err)}`);
    failed = true;
    continue;
  }

  const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  const partyDeps = Object.entries(deps).filter(([name]) => name.startsWith('@partylayer/'));

  if (partyDeps.length === 0) {
    console.log(`- [${template}] no @partylayer/* dependencies`);
    continue;
  }

  for (const [name, range] of partyDeps) {
    const current = workspaceVersions.get(name);
    if (!current) {
      console.error(
        `X [${template}] pins "${name}": "${range}", but no such package exists in the workspace. ` +
          `Fix the package name in the template's _package.json.`,
      );
      failed = true;
      continue;
    }
    // A `workspace:*`-style range (should never ship in a template) cannot be
    // checked with semver; flag it so it does not slip into published scaffolds.
    if (/^workspace:/.test(range)) {
      console.error(
        `X [${template}] pins "${name}": "${range}" (a workspace protocol range). ` +
          `Templates must pin a published semver range (e.g. "^${current}").`,
      );
      failed = true;
      continue;
    }
    if (!semver.satisfies(current, range, { includePrerelease: false })) {
      console.error(
        `X [${template}] pins "${name}": "${range}", but the current workspace version is ` +
          `${current} and the range cannot resolve to it. The scaffolded app would install a ` +
          `stale ${name}. Bump the template's _package.json to a range that includes ${current} ` +
          `(e.g. "^${current}").`,
      );
      failed = true;
    } else {
      console.log(`OK [${template}] ${name} "${range}" includes current ${current}`);
    }
  }
}

if (failed) {
  console.error('\nX Scaffold-template version check FAILED. Update the stale template pins above.');
  process.exit(1);
}

console.log('\nOK Scaffold-template version check PASSED.');
