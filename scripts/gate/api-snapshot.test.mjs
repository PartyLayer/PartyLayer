import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const gateDir = dirname(fileURLToPath(import.meta.url));

// Run the real gate against a disposable package tree. --update below writes
// only these fixture snapshots; the repository's reviewed snapshots stay intact.
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'pl-api-gate-'));
  try {
    mkdirSync(join(root, 'scripts', 'gate'), { recursive: true });
    mkdirSync(join(root, 'packages', 'adapters'), { recursive: true });
    const pkgDir = join(root, 'packages', 'fixture');
    mkdirSync(join(pkgDir, 'dist'), { recursive: true });
    for (const name of ['api-snapshot.mjs', 'api-normalize.mjs', 'api-declarations.mjs', 'api-packaging.mjs']) {
      cpSync(join(gateDir, name), join(root, 'scripts', 'gate', name));
    }
    symlinkSync(resolve(gateDir, '../../node_modules'), join(root, 'node_modules'), 'junction');
    const pkg = {
      name: '@fixture/package', version: '1.0.0', types: './dist/index.d.ts',
      exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/default.js' } },
      peerDependencies: { sdk: '^1' }, peerDependenciesMeta: { sdk: { optional: true } },
    };
    const manifest = () => writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg));
    manifest();
    const entry = join(pkgDir, 'dist', 'index.d.ts');
    const chunk = join(pkgDir, 'dist', 'shared.d.ts');
    writeFileSync(entry, "export { Client } from './shared.js';\n");
    writeFileSync(chunk, 'export interface Client { value: string; }\n');
    const gate = (...args) => {
      const result = spawnSync(process.execPath, [join(root, 'scripts', 'gate', 'api-snapshot.mjs'), ...args], {
        cwd: root, encoding: 'utf8', timeout: 30_000,
      });
      assert.ifError(result.error);
      return result;
    };
    const updated = gate('--update');
    assert.equal(updated.status, 0, updated.stderr);
    assert.equal(gate().status, 0);
    run({ pkg, manifest, entry, chunk, gate });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('real gate detects a shared-file API change and fails closed on a missing declaration', () => {
  fixture(({ entry, chunk, gate }) => {
    const rootText = readFileSync(entry, 'utf8');
    writeFileSync(chunk, 'export interface Client { value: number; }\n');
    assert.equal(readFileSync(entry, 'utf8'), rootText);
    const drifted = gate();
    assert.equal(drifted.status, 1);
    assert.match(drifted.stderr, /public type surface differs/);
    rmSync(chunk);
    const missing = gate();
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Missing local declaration.*shared\.js/);
  });
});

test('real gate detects optional-peer and exports-condition-order changes', () => {
  fixture(({ pkg, manifest, gate }) => {
    pkg.peerDependenciesMeta.sdk.optional = false;
    manifest();
    const peerDrift = gate();
    assert.equal(peerDrift.status, 1);
    assert.match(peerDrift.stderr, /packaging surface differs/);
    pkg.peerDependenciesMeta.sdk.optional = true;
    pkg.exports['.'] = { types: './dist/index.d.ts', default: './dist/default.js', import: './dist/index.js' };
    manifest();
    const conditionDrift = gate();
    assert.equal(conditionDrift.status, 1);
    assert.match(conditionDrift.stderr, /packaging surface differs/);
  });
});
