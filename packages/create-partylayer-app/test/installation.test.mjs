import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));

// Exercise the shipped CLI as a subprocess. Fake package managers make install
// outcomes deterministic without registry access or modifying the user's setup.
function run({ pm = 'npm', status = 0, missing = false, signal = false, noInstall = false } = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'partylayer-install-')));
  try {
    const bin = join(directory, 'bin');
    const project = join(directory, 'my-app');
    const record = join(directory, 'install.json');
    mkdirSync(bin);
    if (!missing) writeFileSync(join(bin, pm), `#!${process.execPath}
import('node:fs').then(({ writeFileSync }) => {
  writeFileSync(${JSON.stringify(record)}, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));
  console.error('PACKAGE_MANAGER_DIAGNOSTIC');
  ${signal ? "process.kill(process.pid, 'SIGTERM');" : `process.exit(${status});`}
});
`, { mode: 0o755 });
    const result = spawnSync(process.execPath, [cli, 'my-app', '--template', 'vanilla', '--pm', pm, '--no-git', ...(noInstall ? ['--no-install'] : [])], {
      cwd: directory, encoding: 'utf8', timeout: 20_000,
      env: { ...process.env, PATH: bin, NO_COLOR: '1' },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'the CLI itself must finish normally');
    const output = result.stdout + result.stderr;
    const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
    assert.equal(manifest.name, 'my-app', 'generated project must be preserved');
    assert.match(readFileSync(join(project, 'src/main.ts'), 'utf8'), /@partylayer\/sdk/);
    let invocation = null;
    try { invocation = JSON.parse(readFileSync(record, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { result, output, invocation, project };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const pm of ['npm', 'pnpm', 'yarn']) {
  test(`${pm}: successful install preserves the normal next steps`, () => {
    const { result, output, invocation, project } = run({ pm });
    assert.equal(result.status, 0);
    assert.deepEqual(invocation, { cwd: project, args: ['install'] });
    assert.match(output, /PACKAGE_MANAGER_DIAGNOSTIC/);
    assert.match(output, /Dependencies installed/);
    assert.match(output, /Done\./);
    assert.ok(output.includes(`${pm} run dev`));
    assert.doesNotMatch(output, /setup is incomplete/);
  });

  test(`${pm}: failed install keeps files, exposes diagnostics and exits with its status`, () => {
    const { result, output, invocation, project } = run({ pm, status: 23 });
    assert.equal(result.status, 23);
    assert.deepEqual(invocation, { cwd: project, args: ['install'] });
    assert.match(output, /PACKAGE_MANAGER_DIAGNOSTIC/);
    assert.match(output, /setup is incomplete/);
    assert.match(output, /cd my-app/);
    assert.ok(output.includes(`${pm} install`));
    assert.ok(output.includes(`${pm} run dev`));
    assert.doesNotMatch(output, /Done\.|Dependencies installed/);
  });
}

test('an unavailable package manager returns a useful failure rather than success', () => {
  const { result, output, invocation } = run({ missing: true });
  assert.equal(result.status, 1);
  assert.equal(invocation, null);
  assert.match(output, /Could not start npm:.*ENOENT/);
  assert.match(output, /setup is incomplete/);
  assert.doesNotMatch(output, /Done\./);
});

test('a terminated installer returns failure and recovery instructions', () => {
  const { result, output } = run({ signal: true });
  assert.equal(result.status, 1);
  assert.match(output, /setup is incomplete/);
  assert.match(output, /npm install/);
  assert.doesNotMatch(output, /Done\./);
});

test('--no-install deliberately skips installation and keeps the complete next steps', () => {
  const { result, output, invocation } = run({ noInstall: true });
  assert.equal(result.status, 0);
  assert.equal(invocation, null);
  assert.match(output, /Done\./);
  assert.match(output, /npm install/);
  assert.match(output, /npm run dev/);
  assert.doesNotMatch(output, /setup is incomplete|PACKAGE_MANAGER_DIAGNOSTIC/);
});
