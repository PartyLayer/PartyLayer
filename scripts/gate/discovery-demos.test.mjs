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
const SHOWCASE_APPS = ['apps/demo', 'apps/tokenization', 'apps/dvp'];

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

/**
 * The shared adapter set. An app that depends on this package registers whatever
 * the package registers, so for this guard the package's dependencies and source
 * count as the app's. Without this the guard would fail the moment the wallet
 * wiring moved out of each app and into one place, which is the opposite of what
 * it is for: it checks that a wallet is genuinely reachable from the app, not
 * that the import statement sits in a particular file.
 */
const SHARED_ADAPTERS_DIR = 'apps/shared-adapters';
const SHARED_ADAPTERS_PKG = '@partylayer/demo-adapters';

/** Raw dependency names a package directory declares (prod + dev). */
function ownDependencies(dir) {
  const p = join(ROOT, dir, 'package.json');
  if (!existsSync(p)) return null;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  return new Set([...Object.keys(j.dependencies ?? {}), ...Object.keys(j.devDependencies ?? {})]);
}

/** Directories whose deps and source stand in for the app's: itself, plus the
 *  shared adapter set when the app depends on it. */
function resolutionRoots(appDir) {
  const own = ownDependencies(appDir);
  if (!own) return null;
  const roots = [appDir];
  if (own.has(SHARED_ADAPTERS_PKG) && existsSync(join(ROOT, SHARED_ADAPTERS_DIR))) {
    roots.push(SHARED_ADAPTERS_DIR);
  }
  return roots;
}

/** The dependency names an app declares, following the shared set. */
function appDependencies(appDir) {
  const roots = resolutionRoots(appDir);
  if (!roots) return null;
  const all = new Set();
  for (const dir of roots) for (const d of ownDependencies(dir) ?? []) all.add(d);
  return all;
}

/** Whether any source file under a directory references the package name. */
function sourceReferences(dir, pkg) {
  const stack = [join(ROOT, dir, 'src')].filter(existsSync);
  while (stack.length) {
    const d = stack.pop();
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(full);
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        if (readFileSync(full, 'utf8').includes(pkg)) return true;
      }
    }
  }
  return false;
}

/** Whether the app, or the shared set it depends on, references the package. */
function appSourceReferences(appDir, pkg) {
  const roots = resolutionRoots(appDir) ?? [appDir];
  return roots.some((dir) => sourceReferences(dir, pkg));
}

/**
 * Wallet keys an app opts out of at its `buildWalletAdapters({ exclude: [...] })`
 * call. Resolving through the shared set would otherwise let an app drop a wallet
 * silently while the guard still saw it declared in the shared package, which is
 * exactly the blindness this guard exists to prevent. An opt-out is legitimate,
 * but it is an omission and has to be recorded in EXCEPTIONS like any other.
 */
function appExcludedKeys(appDir) {
  const excluded = new Set();
  const stack = [join(ROOT, appDir, 'src')].filter(existsSync);
  while (stack.length) {
    const d = stack.pop();
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(full);
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        const src = readFileSync(full, 'utf8');
        for (const m of src.matchAll(/exclude\s*:\s*\[([^\]]*)\]/g)) {
          for (const key of m[1].matchAll(/['"]([a-z0-9-]+)['"]/gi)) excluded.add(key[1]);
        }
      }
    }
  }
  return excluded;
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

      const via = (resolutionRoots(app) ?? [app]).join(' or ');
      const optedOut = appExcludedKeys(app).has(wallet.id);
      const problems = [];
      if (!declared) problems.push(`neither ${via} depends on ${wallet.pkg}`);
      if (!referenced) problems.push(`no source file under ${via} imports ${wallet.pkg}`);
      if (optedOut) {
        problems.push(
          `${app} opts out of "${wallet.id}" at its buildWalletAdapters exclude list, ` +
            `so the shared set supplying it does not make it reachable here`,
        );
      }

      assert.ok(
        declared && referenced && !optedOut,
        `The stable registry lists discovery-adapter wallet "${wallet.id}" (package ${wallet.pkg}), ` +
          `but ${problems.join(' and ')}. The SDK hides a discovery-adapter entry whose adapter is not ` +
          `supplied, so this wallet is invisible in ${app}.\n` +
          `  Fix: add ${wallet.pkg} (pinned exactly) to ${SHARED_ADAPTERS_DIR}/package.json and register ` +
          `it in ${SHARED_ADAPTERS_DIR}/src/index.ts, which every showcase app consumes. If ${app} ` +
          `deliberately should not carry "${wallet.id}", exclude it at that app's buildWalletAdapters ` +
          `call with a comment, or add "${app}:${wallet.id}" to EXCEPTIONS in this file with a reason.`,
      );
    });
  }
}
