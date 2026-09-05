#!/usr/bin/env node
/**
 * Is the by-hand test coverage still true?
 *
 * Some specs cannot run in CI. `a2-two-extension-isolation` and
 * `a2-console-only-negative` load the ACTUAL unpacked Send and Console
 * extensions into a headed persistent Chromium — MV3 service workers do not run
 * headless, and a hosted runner has no extensions. No workflow can fix that, so
 * pretending otherwise was the previous arrangement: both carried
 * `|| !!process.env.CI`, which made them structurally unable to run where they
 * were reported, and they sat in a green suite asserting nothing for three
 * months while the code they guard was edited twice.
 *
 * That is the specific harm. The a2 specs guard MISROUTING — clicking one wallet
 * reaching another wallet's extension — which is the same defect client.ts names
 * in its own A2.1 comment ("clicking it opened Console"), written in the same
 * commit. We were editing guarded code blind.
 *
 * A checklist does not fix that; a checklist is a skip with a nicer name. What
 * fixes it is making NOT running them visible on a clock. Hence this ledger.
 *
 * WHY THE NIGHTLY AND NOT `pnpm gate`. A check that blocks every PR until
 * somebody runs an extension test by hand will be cleared by typing a date, and
 * then we have a second mechanism that lies. In the nightly, a stale record fails
 * a job, the failure sink opens a tracking issue, and nobody's work stops.
 *
 * WHY A DATE IS NOT ENOUGH. An entry must name the extension versions it ran
 * against and the actual result. A rubber stamp then has to state which builds it
 * claims to have tested, which is at least conspicuous.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const LEDGER = join(ROOT, 'apps/demo/e2e/manual-runs.json');

const fail = (lines) => {
  console.error('\n✗ Manual coverage is not current.\n');
  for (const l of lines) console.error('  ' + l);
  console.error(
    '\n  Run the spec, then update apps/demo/e2e/manual-runs.json with the date,\n' +
      '  the extension versions you ran against, and the result. Its header explains\n' +
      '  why a date alone is not accepted.\n',
  );
  process.exit(1);
};

if (!existsSync(LEDGER)) fail([`Ledger missing: ${LEDGER}`]);

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const maxAgeDays = Number(ledger.maxAgeDays);
if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) fail(['`maxAgeDays` must be a positive number.']);

const problems = [];
const ok = [];

for (const [spec, rec] of Object.entries(ledger.specs ?? {})) {
  if (!existsSync(join(ROOT, spec))) {
    problems.push(`${spec}\n      listed in the ledger but the file does not exist — delete the entry or restore the spec.`);
    continue;
  }
  if (!rec || rec.lastRun === null || rec.lastRun === undefined) {
    problems.push(`${spec}\n      no run has ever been recorded. ${rec?.notes ?? ''}`);
    continue;
  }
  const when = Date.parse(rec.lastRun);
  if (Number.isNaN(when)) {
    problems.push(`${spec}\n      lastRun "${rec.lastRun}" is not a date.`);
    continue;
  }
  const ageDays = Math.floor((Date.now() - when) / 86_400_000);

  // Evidence, not a date. Both of these must be real for the entry to count.
  const versions = Object.entries(rec.extensions ?? {}).filter(([, v]) => typeof v === 'string' && v.trim());
  if (versions.length === 0) {
    problems.push(`${spec}\n      recorded ${rec.lastRun} but names no extension versions. Which builds did it pass against?`);
    continue;
  }
  if (typeof rec.result !== 'string' || !rec.result.trim()) {
    problems.push(`${spec}\n      recorded ${rec.lastRun} with no result. A run with no stated outcome is not a run.`);
    continue;
  }
  if (!/^pass\b/i.test(rec.result)) {
    problems.push(`${spec}\n      last recorded result was "${rec.result}" (${rec.lastRun}). Not passing.`);
    continue;
  }
  if (ageDays > maxAgeDays) {
    problems.push(
      `${spec}\n      last run ${rec.lastRun} — ${ageDays} days ago, over the ${maxAgeDays}-day limit.\n` +
        `      Versions then: ${versions.map(([k, v]) => `${k}@${v}`).join(', ')}`,
    );
    continue;
  }
  ok.push(`${spec} — ${rec.lastRun} (${ageDays}d), ${versions.map(([k, v]) => `${k}@${v}`).join(', ')}, ${rec.result}`);
}

if (ok.length) {
  console.log('\n✓ Current manual runs:');
  for (const l of ok) console.log('  ' + l);
}
if (problems.length) fail(problems);
console.log(`\n✓ All manual coverage recorded within ${maxAgeDays} days.\n`);
