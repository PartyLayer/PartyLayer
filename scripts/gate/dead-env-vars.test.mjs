/**
 * `NEXT_PUBLIC_*` variables that nothing reads.
 *
 * THE INCIDENT. `NEXT_PUBLIC_MOCK_WALLETS` was set in six places — the nightly
 * workflow, three commands in `scripts/verify/e2e.ts`, and two `unset` lines in
 * `scripts/verify/real-wallets.sh` — and read by no product code at all. It had
 * never been wired. Around it grew a whole vocabulary that was not true: a CI job
 * described as running under a mock switch, a "REAL mode" script whose safety step
 * was an `unset` of a variable that did nothing, and four disabled tests whose
 * FIXME comments blamed a switch that had in fact been deleted (`703a645`) rather
 * than one still to come. The demo's actual mock is a provider fixture gated on
 * NODE_ENV, which worked the whole time.
 *
 * WHY THIS CLASS IS WORTH A CHECK. A variable set but never read cannot fail. It
 * produces no error, no warning, and no wrong answer — it quietly licenses a
 * belief. Every reader downstream assumes a mechanism exists because the
 * invocation says so, and the belief outlives the code by however long nobody
 * checks. Ours outlived it by months and switched off four tests on the way.
 *
 * WHY `NEXT_PUBLIC_*` SPECIFICALLY. It needs no allowlist, which is what makes it
 * cheap enough to be worth having. By Next.js convention these exist for exactly
 * one purpose: to be inlined into the client bundle and read by application code.
 * A shell variable may legitimately never be read by us (it configures a tool); a
 * `NEXT_PUBLIC_*` that nothing reads is dead by definition. The broader class —
 * any env var set for a child process and never consumed — needs an allowlist for
 * every variable belonging to pnpm, Playwright, Next, GitHub Actions and Vercel,
 * and an allowlist that large stops being a check and becomes a second thing to
 * maintain. Prefer the narrow rule that is always right.
 *
 * Comments are stripped before scanning, deliberately: writing down that a
 * variable was removed must not itself trip the check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Where a variable can be SET: CI config and repo scripts. */
const SETTER_ROOTS = ['.github', 'scripts'];
/** Where a variable can be READ: shipped application and library code. */
const READER_ROOTS = ['packages', 'apps'];

const SETTER_EXT = new Set(['.yml', '.yaml', '.sh', '.ts', '.mjs', '.js']);
const READER_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx']);

function walk(dir, exts, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.has(extname(entry))) out.push(full);
  }
  return out;
}

/** Drop `#` and `//` comment lines so documenting a dead variable is not itself a use. */
function stripComments(src) {
  return src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('#') && !t.startsWith('//') && !t.startsWith('*');
    })
    .join('\n');
}

const NAME = /NEXT_PUBLIC_[A-Z0-9_]+/g;

test('every NEXT_PUBLIC_* set in CI or scripts is read by product code', () => {
  const SELF = new URL(import.meta.url).pathname;

  const set = new Map(); // name -> where it was set
  for (const file of SETTER_ROOTS.flatMap((r) => walk(join(ROOT, r), SETTER_EXT))) {
    // A checker must not scan itself: this file names the variable from the
    // incident in its own failure message, which is code rather than a comment.
    if (file === SELF) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(NAME)) {
      if (!set.has(m[0])) set.set(m[0], relative(ROOT, file));
    }
  }

  const read = new Set();
  for (const file of READER_ROOTS.flatMap((r) => walk(join(ROOT, r), READER_EXT))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)|process\.env\[['"`](NEXT_PUBLIC_[A-Z0-9_]+)['"`]\]/g)) {
      read.add(m[1] ?? m[2]);
    }
  }

  const dead = [...set.entries()]
    .filter(([name]) => !read.has(name))
    .map(([name, where]) => `${name}  (set in ${where}, read nowhere)`);

  assert.deepEqual(
    dead,
    [],
    `A NEXT_PUBLIC_* variable is set but never read by product code.\n\n  ${dead.join('\n  ')}\n\n` +
      `  These exist only to be inlined into the client bundle, so one that nothing\n` +
      `  reads is dead. Setting it cannot fail — it just licenses the belief that a\n` +
      `  mechanism exists. NEXT_PUBLIC_MOCK_WALLETS did that for months and took four\n` +
      `  tests down with it. Either wire it up, or delete every place that sets it.\n` +
      `  To record that one WAS removed, write it in a comment: comments are stripped\n` +
      `  before this check runs.`,
  );
});
