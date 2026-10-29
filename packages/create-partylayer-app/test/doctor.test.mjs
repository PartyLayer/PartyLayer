import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import semver from 'semver';

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
function fixture(fn) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'partylayer-doctor-')));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function json(path, value) { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, JSON.stringify(value)); }
function pkg(root, name, version, extra = {}) {
  const path = join(root, 'node_modules', name);
  json(join(path, 'package.json'), { name, version, main: 'index.js', ...extra });
  // The doctor must inspect metadata without executing this code.
  writeFileSync(join(path, 'index.js'), "require('node:fs').writeFileSync('EXECUTED', 'unsafe'); throw new Error('must not execute');");
  return path;
}
function app(root, dependencies = { '@partylayer/react': '^3.1.2', react: '^18.2.0', '@tanstack/react-query': '^5.0.0' }) {
  json(join(root, 'package.json'), { dependencies, scripts: { preinstall: 'touch EXECUTED' } });
}
function installedReact(root, extra = {}) {
  pkg(root, '@partylayer/react', '3.1.2', { peerDependencies: { react: '>=18', '@tanstack/react-query': '^5' }, ...extra });
  pkg(root, 'react', '18.3.1'); pkg(root, '@tanstack/react-query', '5.90.12');
}
function snapshot(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => { const path = join(entry.parentPath ?? entry.path, entry.name); return [path, readFileSync(path, 'utf8')]; }).sort();
}
function run(root, args = ['--doctor', '--json']) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000, env: { ...process.env, NO_COLOR: '1' } });
  assert.ifError(result.error); assert.equal(result.signal, null);
  return result;
}
test('healthy React app: valid JSON, metadata only, no mutation or credentials in output', () => fixture(root => {
  app(root); installedReact(root);
  writeFileSync(join(root, '.env'), 'PRIVATE_SENTINEL'); writeFileSync(join(root, '.npmrc'), 'AUTH_SENTINEL');
  const before = snapshot(root); const result = run(root); const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0); assert.equal(report.schemaVersion, 1); assert.equal(report.summary.status, 'pass');
  assert.deepEqual(snapshot(root), before); assert.doesNotMatch(result.stdout, /PRIVATE_SENTINEL|AUTH_SENTINEL|EXECUTED/);
  assert.ok(report.checks.some(check => check.id === 'peer:@partylayer/react:react'));
}));
test('missing and malformed project manifests produce redacted actionable reports', () => fixture(root => {
  for (const content of [null, '{"PRIVATE_SENTINEL":', '[]', '{"dependencies":[]}']) {
    if (content) writeFileSync(join(root, 'package.json'), content);
    const result = run(root); assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).checks.find(check => check.id === 'project').severity, 'error');
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_SENTINEL/);
  }
}));
test('declared but uninstalled package and absent integration fail without installing', () => fixture(root => {
  app(root); assert.equal(run(root).status, 1);
  app(root, {}); const report = JSON.parse(run(root).stdout);
  assert.equal(report.checks.find(check => check.id === 'integration').severity, 'error');
}));
test('missing required peers and incompatible installed ranges fail', () => fixture(root => {
  app(root); pkg(root, '@partylayer/react', '3.1.2', { peerDependencies: { react: '^18', '@tanstack/react-query': '^5' } });
  assert.equal(run(root).status, 1);
  pkg(root, 'react', '17.0.2'); pkg(root, '@tanstack/react-query', '5.90.12');
  const result = run(root); assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).checks.find(check => check.id === 'peer:@partylayer/react:react').severity, 'error');
}));
test('optional missing peers are accepted and optional incompatible peers are reported', () => fixture(root => {
  app(root, { '@partylayer/sdk': '^0.20.1' });
  pkg(root, '@partylayer/sdk', '0.20.1', { peerDependencies: { optional: '^2' }, peerDependenciesMeta: { optional: { optional: true } } });
  assert.equal(run(root).status, 0);
  pkg(root, 'optional', '1.0.0'); assert.equal(run(root).status, 1);
}));
test('installed integration and application peer versions must match their own declared ranges', () => fixture(root => {
  app(root, { '@partylayer/react': '^3.2.0', react: '^18', '@tanstack/react-query': '^5' }); installedReact(root);
  assert.equal(run(root).status, 1);
  app(root, { '@partylayer/react': '^3.1.2', react: '^19', '@tanstack/react-query': '^5' });
  const result = run(root); assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).checks.find(check => check.id === 'application-peer:react').severity, 'error');
}));
test('Node requirements use compound SemVer ranges for application and framework', () => fixture(root => {
  app(root, { '@partylayer/sdk': '^0.20.1', next: '*' }); pkg(root, '@partylayer/sdk', '0.20.1');
  pkg(root, 'next', '16.0.0', { engines: { node: '<1 || >=999' } });
  assert.equal(run(root).status, 1);
  pkg(root, 'next', '16.0.0', { engines: { node: '>=18 <999' } }); assert.equal(run(root).status, 0);
  json(join(root, 'package.json'), { dependencies: { '@partylayer/sdk': '*' }, engines: { node: '>=999' } });
  assert.equal(run(root).status, 1);
}));
test('linked workspace packages and exports-hidden metadata resolve without entry execution', () => fixture(root => {
  app(root, { '@partylayer/sdk': 'workspace:*' });
  const linked = join(root, 'local-sdk');
  json(join(linked, 'package.json'), { name: '@partylayer/sdk', version: '0.20.1', exports: './not-built.js' });
  mkdirSync(join(root, 'node_modules/@partylayer'), { recursive: true });
  symlinkSync(linked, join(root, 'node_modules/@partylayer/sdk'), 'dir');
  const result = run(root); assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).summary.status, 'warning');
}));
test('duplicate React context is an error even when both copies satisfy peers', () => fixture(root => {
  app(root); installedReact(root);
  pkg(join(root, 'node_modules/@partylayer/react'), 'react', '18.3.1');
  const result = run(root); assert.equal(result.status, 1);
  assert.ok(JSON.parse(result.stdout).checks.some(check => check.id === 'duplicate:@partylayer/react:react'));
}));
test('old integration baseline and competing lockfiles are warnings, not automatic upgrades', () => fixture(root => {
  app(root, { '@partylayer/sdk': '^0.19.0' }); pkg(root, '@partylayer/sdk', '0.19.0');
  writeFileSync(join(root, 'package-lock.json'), '{}'); writeFileSync(join(root, 'pnpm-lock.yaml'), '');
  const result = run(root); assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout); assert.equal(report.summary.warnings, 2);
}));
test('invalid flag combinations exit 2 and do not scaffold', () => fixture(root => {
  for (const args of [['--json'], ['--doctor', '--template', 'vanilla'], ['--doctor', '--no-install'], ['--doctor', 'one', 'two'], ['--doctor', '--fix']]) {
    assert.equal(run(root, args).status, 2); assert.deepEqual(readdirSync(root), []);
  }
}));
test('explicit project paths and human report work; directory named doctor remains scaffoldable', () => fixture(root => {
  const child = join(root, 'app'); mkdirSync(child); app(child, { '@partylayer/sdk': '*' }); pkg(child, '@partylayer/sdk', '0.20.1');
  const result = run(root, ['--doctor', 'app']); assert.equal(result.status, 0); assert.match(result.stdout, /offline installation checks/);
  assert.equal(run(root, ['doctor', '--template', 'vanilla', '--pm', 'npm', '--no-install', '--no-git']).status, 0);
  assert.ok(readFileSync(join(root, 'doctor/package.json'), 'utf8').includes('@partylayer/sdk'));
}));

test('CLI Node support does not advertise runtimes excluded by its direct runtime dependencies', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const name of Object.keys(manifest.dependencies)) {
    const dependency = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
    if (dependency.engines?.node) assert.ok(semver.subset(manifest.engines.node, dependency.engines.node), `${name} excludes a runtime advertised by the CLI`);
  }
});
