/**
 * Discovery-adapter demo guard (gate:discovery-demos).
 *
 * We tell wallet teams Path B works and published a guide saying so, but the proof
 * is our own live demos wiring a discovery-adapter wallet. Walley is the first. The
 * risk is the second and third: a wallet added to the stable registry on the
 * discovery-adapter path is invisible in the demos until someone remembers to wire
 * it (the SDK hides a discovery-adapter entry whose adapter is not supplied). This
 * guard makes forgetting impossible: for every discovery-adapter wallet in the stable
 * registry, each showcase demo must declare that wallet's adapter package and
 * reference it in source. Adding a wallet is then a deliberate line per demo; skipping
 * one fails here.
 *
 * Full auto-install was considered and rejected: `gate:registry` validates the
 * registry against a schema and the cip0103 flag, not package code, so auto-installing
 * every listed adapter would make a metadata review the only checkpoint before third
 * party code runs on our public demo pages. Detection with deliberate installation
 * keeps the human as that checkpoint while making omission impossible.
 *
 * Not crying wolf: a demo may deliberately omit a wallet by adding it to EXCEPTIONS
 * below with a reason (the same pattern docs-drift uses for quick-start). The failure
 * message names the wallet, its package, and the app, and says what to do.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Demos that must carry every discovery-adapter wallet (the live Path B proof). */
const SHOWCASE_APPS = ['apps/tokenization', 'apps/dvp'];

/**
 * Deliberate, documented omissions: `${app}:${walletId}` -> reason. A demo that
 * genuinely should not carry a wallet is recorded here rather than silently skipped,
 * so a reviewer sees the choice. Empty today.
 */
const EXCEPTIONS = {
  // 'apps/dvp:some-wallet': 'reason a reviewer can evaluate',
};

/** Discovery-adapter wallets in the stable registry: { id, package }. */
function stableDiscoveryWallets() {
  const reg = JSON.parse(readFileSync(join(ROOT, 'registry/v1/stable/registry.json'), 'utf8'));
  const wallets = reg.wallets ?? reg.data?.wallets ?? [];
  return wallets
    .filter((w) => w.adapter?.transport === 'discovery-adapter')
    .map((w) => ({ id: String(w.id), pkg: String(w.adapter?.type ?? '') }));
}

/** The dependency names an app declares (prod + dev). */
function appDependencies(appDir) {
  const p = join(ROOT, appDir, 'package.json');
  if (!existsSync(p)) return null;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  return new Set([...Object.keys(j.dependencies ?? {}), ...Object.keys(j.devDependencies ?? {})]);
}

/** Whether any source file under the app references the package name. */
function appSourceReferences(appDir, pkg) {
  const srcRoots = [join(ROOT, appDir, 'src')];
  const stack = [...srcRoots.filter(existsSync)];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(full);
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        if (readFileSync(full, 'utf8').includes(pkg)) return true;
      }
    }
  }
  return false;
}

const DISCOVERY_WALLETS = stableDiscoveryWallets();

test('the stable registry has at least one discovery-adapter wallet to prove the path', () => {
  assert.ok(
    DISCOVERY_WALLETS.length > 0,
    'No discovery-adapter wallet in the stable registry. If this is intentional the guard is moot; ' +
      'if not, the Path B proof has regressed.',
  );
});

for (const app of SHOWCASE_APPS) {
  for (const wallet of DISCOVERY_WALLETS) {
    test(`${app} wires discovery-adapter wallet "${wallet.id}" (${wallet.pkg})`, () => {
      if (EXCEPTIONS[`${app}:${wallet.id}`]) return; // documented, deliberate omission

      const deps = appDependencies(app);
      assert.ok(deps, `${app}/package.json not found.`);
      const declared = deps.has(wallet.pkg);
      const referenced = appSourceReferences(app, wallet.pkg);

      const problems = [];
      if (!declared) problems.push(`${app}/package.json does not depend on ${wallet.pkg}`);
      if (!referenced) problems.push(`no source file under ${app}/src imports ${wallet.pkg}`);

      assert.ok(
        declared && referenced,
        `The stable registry lists discovery-adapter wallet "${wallet.id}" (package ${wallet.pkg}), ` +
          `but ${problems.join(' and ')}. The SDK hides a discovery-adapter entry whose adapter is not ` +
          `supplied, so this wallet is invisible in ${app}.\n` +
          `  Fix: install ${wallet.pkg} (pinned exactly) in ${app} and supply its adapter alongside the ` +
          `others (see apps/tokenization/src/App.tsx for the pattern). If ${app} deliberately should not ` +
          `carry "${wallet.id}", add "${app}:${wallet.id}" to EXCEPTIONS in this file with a reason.`,
      );
    });
  }
}
