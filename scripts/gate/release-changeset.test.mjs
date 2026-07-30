/**
 * Release changeset guard (gate:release-changeset).
 *
 * Catches the recurring slip where a change reaches main that alters what a
 * publishable package ships, but no changeset covers it, so `changeset version`
 * bumps nothing and the change never reaches npm. This has happened repeatedly:
 * an sdk fix and a react-native fix that each changed source with no changeset,
 * a `sideEffects` flag added to seventeen manifests (which a source-only eye
 * misses entirely), and stale scaffold-template pins that ship inside
 * create-partylayer-app's `templates` directory.
 *
 * For every publishable package it compares the package's `<name>@<version>` git
 * tag (the repo tags every release) against HEAD. `dist` is built output and is
 * NOT committed, so the comparison is against the SOURCE that produces it:
 *   - `src/`, excluding tests, snapshots, and stories (they never ship);
 *   - any committed directory the `files` allowlist ships that is not `dist`
 *     (today: create-partylayer-app's `templates`);
 *   - the package.json fields consumers actually receive (see SHIPPING_FIELDS),
 *     ignoring version, scripts, and devDependencies.
 * If anything in that scope changed and no pending changeset names the package,
 * it fails with a message that names the package, the changed paths or fields,
 * and exactly what to do.
 *
 * Not crying wolf is a design goal: a check that fires on things which need no
 * release gets worked around within a week, and then it protects nothing. So:
 *   - test files, snapshots, and stories are excluded and the exclusion list is
 *     printed in every failure so a developer can see why a file did or did not
 *     count;
 *   - an EMPTY changeset (`pnpm changeset --empty`) is honored as changesets'
 *     own sanctioned way to say a change deliberately needs no release; while one
 *     is present the guard stays quiet (it is consumed at the next version run);
 *   - a MISSING tag is a loud, named failure rather than a silent pass, because a
 *     missing tag itself signals that a version skipped the release process (or,
 *     in CI, that the checkout did not fetch tags) - EXCEPT on a version PR, where
 *     a package legitimately has a bumped version with no tag yet (the tag follows
 *     at `changeset publish`). That expected state is recognized by its CHANGELOG
 *     heading for the new version, the deterministic output of `changeset version`,
 *     so it is exempted while a version set by hand (no such heading) still fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

/** Base dirs that hold workspace packages (non-recursive, matching the api gate). */
const BASE_DIRS = ['packages', join('packages', 'adapters')];

/** package.json fields that reach the registry and affect a consumer's install. */
const SHIPPING_FIELDS = [
  'dependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'optionalDependencies',
  'exports',
  'main',
  'module',
  'types',
  'typings',
  'bin',
  'files',
  'sideEffects',
  'type',
];

/** Human-readable exclusion rules, printed in every failure message. */
const EXCLUSIONS = [
  'tests: *.test.* / *.spec.* / __tests__/ / __mocks__/',
  'snapshots: __snapshots__/ / *.snap',
  'stories: *.stories.*',
  'built output: dist/ (not committed; the compare is against the src/ that builds it)',
  'docs and config at the package root (README, tsconfig, etc.): not source and not a shipped directory',
  'package.json fields that never reach a consumer: version, scripts, devDependencies',
];

/** True for a package-relative path that can never reach a consumer. */
function isNonShipping(relPath) {
  return (
    /(^|\/)__tests__\//.test(relPath) ||
    /(^|\/)__mocks__\//.test(relPath) ||
    /(^|\/)__snapshots__\//.test(relPath) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(relPath) ||
    /\.stories\.[cm]?[jt]sx?$/.test(relPath) ||
    /\.snap$/.test(relPath)
  );
}

/** Publishable packages: non-private, discovered non-recursively under BASE_DIRS. */
function publishablePackages() {
  const out = [];
  for (const base of BASE_DIRS) {
    const abs = join(ROOT, base);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(abs, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const j = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (j.private === true || !j.name || !j.version) continue;
      out.push({
        name: j.name,
        version: j.version,
        dir: relative(ROOT, join(abs, entry.name)),
        files: Array.isArray(j.files) ? j.files : null,
        pkg: j,
      });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Pending changesets: the set of package names any changeset bumps, and whether
 * an EMPTY changeset is present (empty frontmatter = a deliberate "no release").
 */
function pendingChangesets() {
  const dir = join(ROOT, '.changeset');
  const named = new Set();
  let hasEmpty = false;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.toLowerCase() === 'readme.md') continue;
      const lines = readFileSync(join(dir, f), 'utf8').split(/\r?\n/);
      if (lines[0]?.trim() !== '---') continue; // not a changeset
      const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
      const front = (end > 0 ? lines.slice(1, end) : []).join('\n');
      if (front.trim() === '') {
        hasEmpty = true; // `changeset --empty` produces empty frontmatter
        continue;
      }
      for (const line of front.matchAll(/^\s*["']?(@?[\w./-]+)["']?\s*:\s*(patch|minor|major)\b/gim)) {
        named.add(line[1]);
      }
    }
  }
  return { named, hasEmpty };
}

function tagExists(tag) {
  try {
    git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the package's CHANGELOG has a heading for its CURRENT version.
 *
 * This is the deterministic fingerprint of a version PR. `changeset version` does
 * three things together: it bumps the version field, consumes (deletes) the
 * changesets that covered the bump, and writes a `## <version>` heading with their
 * contents to the package's CHANGELOG. The matching git tag is created LATER, by
 * `changeset publish` at publish time. So between the version PR and publish, a
 * bumped package legitimately has a version with no tag yet, and the CHANGELOG
 * heading is what tells that expected state apart from a version set by hand
 * outside the release process (which leaves no such heading). changeset renders
 * the heading as `## x.y.z`; be tolerant of surrounding whitespace but anchor to a
 * heading line so a version merely mentioned in prose does not count.
 */
function changelogHasCurrentVersion(pkg) {
  const changelog = join(ROOT, pkg.dir, 'CHANGELOG.md');
  if (!existsSync(changelog)) return false;
  const escaped = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*$`, 'm').test(readFileSync(changelog, 'utf8'));
}

/** Shipping-relevant path changes between tag and HEAD under the package dir. */
function shippingPathChanges(pkg, tag) {
  const raw = git('diff', '--name-only', tag, 'HEAD', '--', pkg.dir);
  const paths = raw ? raw.split('\n').filter(Boolean) : [];
  const srcPrefix = `${pkg.dir}/src`;
  // Committed directories the files allowlist ships, other than built dist.
  const shipDirs = (pkg.files ?? [])
    .filter((f) => f && f !== 'dist')
    .map((f) => `${pkg.dir}/${f}`)
    .filter((p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isDirectory());
  const hits = [];
  for (const p of paths) {
    if (p === `${pkg.dir}/package.json`) continue; // fields handled separately
    if (p.split('/').pop() === 'CHANGELOG.md') continue; // generated by changesets
    if (isNonShipping(relative(pkg.dir, p))) continue;
    const underSrc = p === srcPrefix || p.startsWith(`${srcPrefix}/`);
    const underShip = shipDirs.some((sd) => p === sd || p.startsWith(`${sd}/`));
    if (underSrc || underShip) hits.push(p);
  }
  return hits;
}

/** Consumer-facing package.json fields that differ between tag and HEAD. */
function manifestFieldChanges(pkg, tag) {
  let old;
  try {
    old = JSON.parse(git('show', `${tag}:${pkg.dir}/package.json`));
  } catch {
    return [];
  }
  const now = pkg.pkg;
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return SHIPPING_FIELDS.filter((f) => !same(old[f], now[f]));
}

const PACKAGES = publishablePackages();
const { named: COVERED, hasEmpty: EMPTY_CHANGESET } = pendingChangesets();

test('every publishable package is released or is a pending version bump', () => {
  // A missing `<name>@<version>` tag is a finding UNLESS the package is mid-release:
  // `changeset version` has bumped it and written its CHANGELOG heading, and the tag
  // is created later by `changeset publish`. That version PR state is expected, so it
  // is exempted here. A version with neither a tag nor a CHANGELOG heading was set
  // outside the release process, which is exactly the slip this test must still catch.
  const unreleased = PACKAGES.filter(
    (p) => !tagExists(`${p.name}@${p.version}`) && !changelogHasCurrentVersion(p),
  ).map((p) => `${p.name}@${p.version}`);
  assert.deepEqual(
    unreleased,
    [],
    `No git tag AND no CHANGELOG entry for: ${unreleased.join(', ')}. A version PR is exempt ` +
      `(changeset version writes a "## <version>" CHANGELOG heading, and the tag follows at ` +
      `changeset publish); these have neither, so the version was set outside the release process. ` +
      `Cut the release for this version, or correct the version field. In CI, set actions/checkout ` +
      `with fetch-depth: 0 so release tags are present to compare against.`,
  );
});

for (const pkg of PACKAGES) {
  test(`${pkg.name}: shipping changes since ${pkg.name}@${pkg.version} are covered by a changeset`, (t) => {
    const tag = `${pkg.name}@${pkg.version}`;
    if (!tagExists(tag)) {
      // No released tag to diff against: either a pending version bump (the release
      // test exempts it) or a missing-tag finding (the release test reports it).
      // Coverage is moot for a bump anyway, since the consumed changeset is its cover.
      t.skip(`no ${tag} tag to diff against (pending version bump or a release-tag finding)`);
      return;
    }
    const pathHits = shippingPathChanges(pkg, tag);
    const fieldHits = manifestFieldChanges(pkg, tag);
    if (pathHits.length === 0 && fieldHits.length === 0) return; // nothing that ships changed
    if (EMPTY_CHANGESET) return; // sanctioned "no release intended" marker
    if (COVERED.has(pkg.name)) return; // a changeset already names this package

    const what = [];
    if (pathHits.length) what.push(`changed shipping paths: ${pathHits.join(', ')}`);
    if (fieldHits.length) what.push(`changed package.json fields: ${fieldHits.join(', ')}`);
    assert.fail(
      `${pkg.name} has unreleased changes that reach the registry (${what.join('; ')}), but no ` +
        `changeset covers it, so publishing would ship nothing for it.\n` +
        `  Fix: add a changeset naming ${pkg.name} (pnpm changeset). If this change deliberately ` +
        `needs no release (a revert, a moved comment), add an empty changeset (pnpm changeset --empty).\n` +
        `  Not counted (cannot reach a consumer): ${EXCLUSIONS.join('; ')}.`,
    );
  });
}
