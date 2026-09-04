/**
 * Test-skip guard (gate:test-skips).
 *
 * Catches a suite that reports green while not running itself.
 *
 * `packages/adapters/console` had 33 tests written as `it.skipIf(!isBrowser)`
 * where `isBrowser` was `typeof window !== 'undefined'` and the vitest
 * environment was `node`. The condition was therefore always false, the 33
 * never ran, and the suite reported `55 tests | 33 skipped` — 60% of the
 * adapter's coverage absent behind a green tick. It hid a real defect: the
 * `detectInstalled` contract tests existed, passed once run, and had never run.
 *
 * Two tests in that set turned out to be broken in ways only running them could
 * reveal — one asserted a `target` value the adapter deliberately stopped
 * sending, the other could never reach the code it named because the shared mock
 * always defined the method whose absence it was testing. Both had been
 * "passing" for as long as they had been skipped.
 *
 * The same shape, weaker, existed in loop and console as assertions wrapped in
 * `if (!isBrowser) { ... }`: the body runs, but only ever covers the SSR guard,
 * so the branch that actually ships has no coverage while the test's NAME claims
 * otherwise.
 *
 * WHAT THIS ENFORCES, and why it is structural rather than a count:
 *
 *   1. No environment conditional in a test file. Not `isBrowser`, not
 *      `skipIf(!isBrowser)`, not `if (typeof window ...)` around assertions.
 *      A test that needs a different environment declares it with a
 *      `// @vitest-environment <env>` docblock at the top of its own file, which
 *      vitest honours per-file over the package config. The environment becomes
 *      the fixture instead of a runtime branch that can silently choose to
 *      assert nothing.
 *
 *   2. A skip ratio ceiling per package, plus per-package skip counts printed on
 *      every run, pass or fail, so a skip is visible rather than buried.
 *
 * BE CLEAR ABOUT WHICH HALF DOES THE WORK. Rule 2 would NOT have caught the
 * incident above: `it.skipIf(cond)` is not `it.skip`, so a static count sees
 * zero skips in the very file that skipped 33 tests, and only the runtime
 * summary knew. Rule 1 is what catches this class. Rule 2 is a backstop for
 * literal `.skip` / `.todo` accumulating, and the printed counts are there so
 * the runtime number has somewhere to be noticed.
 *
 * Policing a count alone would have invited the 34th `skipIf`. Forbidding the
 * conditional removes the affordance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const SEARCH_ROOTS = ['packages'];

/** Highest share of a package's tests that may be skipped before this fails. */
const MAX_SKIP_RATIO = 0.1;

/**
 * Patterns that make a test's execution depend on the runtime environment.
 * Each is the literal shape found in this repo, not a guess.
 */
const ENV_CONDITIONALS = [
  {
    re: /\bconst\s+isBrowser\s*=\s*typeof\s+window/,
    why: 'derives an environment flag; declare `// @vitest-environment jsdom|node` at the top of the file instead',
  },
  {
    re: /\.(skipIf|runIf)\(\s*!?\s*isBrowser\s*\)/,
    why: 'skips on an environment flag; split the case into its own file with a `// @vitest-environment` docblock',
  },
  {
    re: /if\s*\(\s*!?\s*isBrowser\s*\)/,
    why: 'branches assertions on the environment; under the wrong one this asserts nothing while still reporting a pass',
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(test|spec)\.(ts|tsx|mts|js|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const testFiles = SEARCH_ROOTS.flatMap((r) => {
  try { return walk(join(ROOT, r)); } catch { return []; }
});

test('no test gates its own execution on the runtime environment', () => {
  const offences = [];
  for (const file of testFiles) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (const { re, why } of ENV_CONDITIONALS) {
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        if (re.test(line)) {
          offences.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 72)}\n      ${why}`);
        }
      });
    }
  }
  assert.deepEqual(
    offences,
    [],
    `Tests must not choose at runtime whether to assert.\n\n  ${offences.join('\n  ')}\n\n` +
      `  A test needing a different environment declares it per-file:\n` +
      `      // @vitest-environment node\n` +
      `  as the FIRST line of the file. vitest honours that over the package config,\n` +
      `  so the environment is a fixture rather than a branch that can silently pass\n` +
      `  while asserting nothing. See scripts/gate/test-skips.test.mjs for the incident.`,
  );
});

test(`no package skips more than ${MAX_SKIP_RATIO * 100}% of its own tests`, () => {
  // Vitest reports skips per package on stdout; this asserts on the source so it
  // runs without a test run, and stays honest if a package is excluded from CI.
  const perPackage = new Map();
  for (const file of testFiles) {
    const pkg = relative(ROOT, file).split('/').slice(0, 3).join('/');
    const src = readFileSync(file, 'utf8');
    const total = (src.match(/\b(it|test)\s*(\.\w+)?\s*\(/g) || []).length;
    const skipped = (src.match(/\b(it|test|describe)\s*\.\s*(skip|todo)\b/g) || []).length;
    const prev = perPackage.get(pkg) || { total: 0, skipped: 0 };
    perPackage.set(pkg, { total: prev.total + total, skipped: prev.skipped + skipped });
  }

  const over = [];
  const report = [];
  for (const [pkg, { total, skipped }] of [...perPackage].sort()) {
    if (total === 0) continue;
    const ratio = skipped / total;
    report.push(`  ${String(skipped).padStart(3)} / ${String(total).padEnd(4)} skipped  ${pkg}`);
    if (ratio > MAX_SKIP_RATIO) {
      over.push(`${pkg}: ${skipped} of ${total} (${(ratio * 100).toFixed(0)}%)`);
    }
  }
  // Printed on every run, pass or fail: a skip should be visible, not buried in
  // a green summary. This is the half of the guard that does the day-to-day work.
  console.log('\nskip counts per package:\n' + report.join('\n') + '\n');

  assert.deepEqual(
    over,
    [],
    `A suite that reports green while not running itself is not a passing suite.\n` +
      `  Over the ${MAX_SKIP_RATIO * 100}% ceiling: ${over.join('; ')}`,
  );
});
