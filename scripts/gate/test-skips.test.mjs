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
/**
 * Extended to `apps` after the e2e suite turned out to be a third inert.
 *
 * `packages` was the only root for as long as the guard existed, and
 * apps/demo/e2e sat outside it holding four permanent `test.fixme`s, a
 * body-level `test.skip()`, and two specs that had switched themselves off in CI
 * — 8 of 36 tests, 22%, none of it visible to a check scoped to packages. Two of
 * those specs guarded the announce/multi-provider misrouting defect, the one
 * named in client.ts's own A2.1 comment, and had asserted nothing since June
 * while that code was edited twice.
 */
const SEARCH_ROOTS = ['packages', 'apps'];

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

/**
 * Playwright-shaped ways a test switches itself off. The vitest patterns above
 * match none of these, which is why widening the root alone would have measured
 * nothing.
 *
 * What is NOT here, deliberately: `test.skip(<condition>, '<reason>')` declared
 * at describe level. That is an honest precondition — "this needs an unpacked
 * extension" — checked before the test runs, stated in the reason, and visible in
 * the report. The forbidden shapes are the ones that decide DURING the run, or
 * that can never run at all.
 */
const PLAYWRIGHT_CONDITIONALS = [
  {
    re: /\btest\.fixme\s*\(/,
    why: 'test.fixme is a permanent off switch with no expiry; delete the test and record the gap, or fix it',
  },
  {
    re: /\btest\.skip\s*\(\s*\)/,
    why: 'a bare test.skip() inside a body decides at runtime whether to assert, and reports green either way',
  },
  {
    re: /\btest\.skip\s*\(\s*true\b/,
    why: 'test.skip(true, …) is unconditional: it never runs and never fails',
  },
  {
    re: /\btest\.(skip|fixme)\s*\([^)]*process\.env\.CI/,
    why: 'a test that excludes itself from CI cannot fail where it is reported; make it a precondition on what it actually needs, and move it out of the suite if CI can never provide that',
  },
];

/** One named exemption, with its reason and what would remove it. */
const EXEMPT = [
  {
    file: 'apps/demo/e2e/walletconnect.spec.ts',
    why:
      'Runtime-skips when no `wc:` URI appears, i.e. the WalletConnect relay is ' +
      'unreachable. Unlike every other case here it DOES run and pass in CI, so ' +
      'forbidding the skip would not recover coverage — it would convert a ' +
      "third party's outage into a red nightly. It cannot be made declarative " +
      'either: wcProjectId() always returns a fallback, so there is no ' +
      'precondition to test up front. Listed rather than silently tolerated. ' +
      'Removing this entry means deciding that a relay outage SHOULD fail the ' +
      'nightly, which is defensible now that a failure sink reports it.',
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
    const rel = relative(ROOT, file);
    const exempt = EXEMPT.find((e) => e.file === rel);
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (const { re, why } of [...ENV_CONDITIONALS, ...PLAYWRIGHT_CONDITIONALS]) {
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        if (re.test(line)) {
          if (exempt) return;
          offences.push(`${rel}:${i + 1}  ${line.trim().slice(0, 72)}\n      ${why}`);
        }
      });
    }
  }

  // Print the exemptions on every run. An exemption nobody sees is the thing it
  // was supposed to replace.
  if (EXEMPT.length) {
    console.log(
      '\nskip-guard exemptions (' + EXEMPT.length + '):\n' +
        EXEMPT.map((e) => `  ${e.file}\n    ${e.why}`).join('\n') + '\n',
    );
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
    // Comments are stripped before counting. Otherwise writing down WHY a test
    // was deleted ("it was test.fixme'd from the day it was written") inflates
    // the very number the rule polices, and the honest record costs you budget.
    const src = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      })
      .join('\n');
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
