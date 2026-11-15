import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveEntryPoints } from './pack-resolve.mjs';

// These execute real CLI subprocesses from an isolated packed payload. Neither
// the package's workspace path nor the checker's current directory has metadata.
for (const [type, extension] of [['module', 'js'], ['commonjs', 'cjs']]) {
  for (const matches of [true, false]) {
    test(`${type} packed bin ${matches ? 'reports' : 'rejects a stale'} package version`, () => {
      const root = mkdtempSync(join(tmpdir(), 'pl-bin-version-'));
      try {
        const payload = join(root, 'payload');
        mkdirSync(join(root, 'node_modules'));
        mkdirSync(join(payload, 'dist'), { recursive: true });
        const pkg = {
          name: 'fixture-cli', version: '7.8.9', type,
          bin: { 'fixture-command': `./dist/cli.${extension}` },
        };
        writeFileSync(join(payload, 'package.json'), JSON.stringify(pkg));
        writeFileSync(join(payload, 'dist', `cli.${extension}`),
          `if (process.argv[2] !== '--version') process.exit(2);\nconsole.log(${JSON.stringify(matches ? pkg.version : '0.1.0')});\n`);
        const problems = resolveEntryPoints(root, pkg, payload, { checkBinVersions: true });
        if (matches) assert.deepEqual(problems, []);
        else {
          assert.equal(problems.length, 1);
          assert.match(problems[0], /fixture-command --version reports "0\.1\.0"; packed package version is 7\.8\.9/);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
}

test('entry resolution leaves CLIs without a version flag unchanged', () => {
  const root = mkdtempSync(join(tmpdir(), 'pl-bin-unversioned-'));
  try {
    const payload = join(root, 'payload');
    mkdirSync(join(root, 'node_modules'));
    mkdirSync(payload);
    const pkg = { name: 'interactive-fixture', version: '1.0.0', bin: './cli.cjs' };
    writeFileSync(join(payload, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(payload, 'cli.cjs'), 'throw new Error("No version flag is supported");\n');
    assert.deepEqual(resolveEntryPoints(root, pkg, payload), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const external of [false, true]) {
  test(`undefined private import is ${external ? 'not blamed on its caller' : 'an own manifest failure'}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'pl-private-import-'));
    try {
      const payload = join(root, 'payload');
      mkdirSync(join(root, 'node_modules'), { recursive: true });
      mkdirSync(payload);
      const pkg = { name: 'private-import-fixture', version: '1.0.0', type: 'module', exports: './index.js' };
      writeFileSync(join(payload, 'package.json'), JSON.stringify(pkg));
      writeFileSync(join(payload, 'index.js'), external ? "import 'external-helper';\n" : "import '#missing-profile';\n");
      if (external) {
        const dependency = join(root, 'node_modules', 'external-helper');
        mkdirSync(dependency);
        writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'external-helper', type: 'module', exports: './index.js' }));
        writeFileSync(join(dependency, 'index.js'), "import '#missing-vendor-map';\n");
      }
      const problems = resolveEntryPoints(root, pkg, payload);
      if (external) assert.deepEqual(problems, []);
      else { assert.ok(problems.length > 0); assert.ok(problems.every(problem => problem.includes('ERR_PACKAGE_IMPORT_NOT_DEFINED'))); }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
