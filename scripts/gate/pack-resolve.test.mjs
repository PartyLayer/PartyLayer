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
        const problems = resolveEntryPoints(root, pkg, payload);
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
