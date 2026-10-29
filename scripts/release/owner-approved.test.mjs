import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { POLICY, assertOwner, selectPackages, preflight, inspectTarball, packageOrder, verifyManifest, stage, registryState } from './owner-approved.mjs';

const context = { repository: POLICY.repository, repositoryId: POLICY.repositoryId, actorId: POLICY.ownerId, triggeringActor: POLICY.ownerLogin, event: 'workflow_dispatch', ref: 'refs/heads/main', sha: 'a'.repeat(40), runId: '123', runAttempt: '1', actions: 'true' };
const cleanEnv = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'TEST_ONLY', RELEASE_PACKAGES: '@partylayer/core', RELEASE_TAG: 'latest' };
function apiFixture(change = () => {}) {
  const response = {
    'git/ref/heads/main': { object: { sha: context.sha } },
    [`environments/${POLICY.environment}`]: { can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [{ type: 'User', reviewer: { id: Number(POLICY.ownerId) } }] }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } },
    [`environments/${POLICY.environment}/deployment-branch-policies`]: { branch_policies: [{ type: 'branch', name: 'main' }] },
  };
  for (const workflow of POLICY.requiredWorkflows) response[`actions/workflows/${workflow}/runs?branch=main&event=push&head_sha=${context.sha}&per_page=100`] = { workflow_runs: [{ id: 10, head_sha: context.sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success' }] };
  change(response);
  const calls = [];
  return { calls, api: async path => { calls.push(path); assert.ok(response[path], path); return structuredClone(response[path]); } };
}
async function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'partylayer-release-test-'));
  try {
    writeFileSync(join(root, 'LICENSE'), 'Test license');
    const sources = new Map();
    for (const [name, path] of Object.entries(POLICY.packages)) {
      const source = { name, version: '1.0.0', main: './dist/index.js' };
      sources.set(name, source); mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify(source));
      writeFileSync(join(root, path, 'README.md'), `# ${name}\n`);
    }
    const output = join(root, 'output'); mkdirSync(output);
    const pack = (name, patch = {}, options = {}) => {
      const source = sources.get(name);
      const temp = mkdtempSync(join(root, 'payload-')), payload = join(temp, 'package');
      mkdirSync(join(payload, 'dist'), { recursive: true });
      writeFileSync(join(payload, 'package.json'), JSON.stringify({ ...source, ...patch }));
      writeFileSync(join(payload, 'dist/index.js'), "throw new Error('package code must not execute during staging');");
      if (!options.noReadme) writeFileSync(join(payload, 'README.md'), options.readme ?? `# ${name}\n`);
      writeFileSync(join(payload, 'LICENSE'), 'Test license');
      const filename = name.replace('@', '').replaceAll('/', '-') + '-1.0.0.tgz';
      execFileSync('tar', ['-czf', join(output, filename), '-C', temp, 'package']);
      return { name, version: '1.0.0', filename, integrity: 'sha512-' + createHash('sha512').update(readFileSync(join(output, filename))).digest('base64'), latestVersion: '0.9.0' };
    };
    const manifest = names => {
      const packages = names.map(name => pack(name));
      const value = { schemaVersion: 1, repositoryId: context.repositoryId, sourceSha: context.sha, runId: context.runId, runAttempt: context.runAttempt, tag: 'latest', packages };
      writeFileSync(join(output, 'manifest.json'), JSON.stringify(value)); return value;
    };
    await fn({ root, output, sources, pack, manifest });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('only the owner on this repository/main may dispatch or rerun', () => {
  assert.doesNotThrow(() => assertOwner(context));
  for (const patch of [{ repository: 'attacker/fork' }, { repositoryId: '1' }, { actorId: '1' }, { triggeringActor: 'cayvox' }, { event: 'pull_request' }, { ref: 'refs/tags/v1' }, { sha: 'main' }, { actions: 'false' }, { runId: undefined }]) assert.throws(() => assertOwner({ ...context, ...patch }));
});
test('package selections reject flags, paths, duplicates and unknown wallets', () => {
  assert.deepEqual(selectPackages(' @partylayer/react,create-partylayer-app '), ['@partylayer/react', 'create-partylayer-app']);
  for (const value of ['', '../private', '--registry=evil', 'create-partylayer-app,create-partylayer-app', '@partylayer/adapter-new-wallet', 'create-partylayer-app; rm -rf /']) assert.throws(() => selectPackages(value));
});
test('preflight verifies current main and exact successful push workflows', async () => {
  const good = apiFixture(); await preflight(context, good.api);
  assert.equal(good.calls.length, 5);
  for (const change of [
    data => { data['git/ref/heads/main'].object.sha = 'b'.repeat(40); },
    data => { Object.values(data).find(value => value.workflow_runs).workflow_runs[0].conclusion = 'failure'; },
    data => { Object.values(data).find(value => value.workflow_runs).workflow_runs[0].event = 'pull_request'; },
    data => { const runs = Object.values(data).find(value => value.workflow_runs).workflow_runs; runs.push({ ...runs[0], id: 11, status: 'in_progress', conclusion: null }); },
  ]) await assert.rejects(preflight(context, apiFixture(change).api));
});
test('missing approval, extra reviewers, admin bypass and wildcard branches fail closed', async () => {
  const key = `environments/${POLICY.environment}`;
  for (const change of [
    data => { data[key].can_admins_bypass = true; },
    data => { delete data[key].can_admins_bypass; },
    data => { data[key].protection_rules = []; },
    data => { data[key].protection_rules[0].reviewers.push({ type: 'User', reviewer: { id: 2 } }); },
    data => { data[key].protection_rules[0].reviewers[0].type = 'Team'; },
    data => { data[key].protection_rules[0].prevent_self_review = true; },
    data => { data[`${key}/deployment-branch-policies`].branch_policies[0].name = '*'; },
  ]) await assert.rejects(preflight(context, apiFixture(change).api));
});
test('registry errors, unknown packages and maintainer changes do not become valid publication state', async () => {
  await assert.rejects(registryState('create-partylayer-app', '1.0.0', async () => new Response('', { status: 503 })));
  await assert.rejects(registryState('create-partylayer-app', '1.0.0', async () => new Response('', { status: 404 })));
  await assert.rejects(registryState('create-partylayer-app', '1.0.0', async () => Response.json({ version: '0.9.0', maintainers: [{ name: 'outsider' }] })));
  const state = await registryState('create-partylayer-app', '1.0.0', async url => url.endsWith('/latest') ? Response.json({ version: '0.9.0', maintainers: [{ name: POLICY.npmMaintainer }] }) : new Response('', { status: 404 }));
  assert.deepEqual(state, { latestVersion: '0.9.0', publishedIntegrity: null });
});
test('real archive verification checks workspace rewrites, entrypoints and source README/license', async () => fixture(async ({ root, output, sources, pack }) => {
  const name = '@partylayer/react';
  const source = { ...sources.get(name), dependencies: { '@partylayer/core': 'workspace:^' } };
  sources.set(name, source);
  const versions = Object.fromEntries([...sources].map(([key, value]) => [key, value.version]));
  const item = pack(name, { dependencies: { '@partylayer/core': '^1.0.0' } });
  assert.equal(inspectTarball(join(output, item.filename), source, versions, root).name, name);
  for (const patch of [{ version: '9.9.9' }, { main: './dist/missing.js' }, { publishConfig: { registry: 'https://evil.invalid' } }, { dependencies: { '@partylayer/core': 'workspace:^' } }, { private: true }]) {
    pack(name, patch); assert.throws(() => inspectTarball(join(output, item.filename), source, versions, root));
  }
  pack(name, {}, { readme: 'different' }); assert.throws(() => inspectTarball(join(output, item.filename), source, versions, root));
}));
test('artifact source/run identity, checksums and filenames are verified before executing npm', async () => fixture(async ({ root, output, manifest }) => {
  const value = manifest(['@partylayer/core']);
  assert.equal(verifyManifest(context, output, root).packages.length, 1);
  for (const patch of [{ sourceSha: 'b'.repeat(40) }, { runId: '999' }, { runAttempt: '2' }, { repositoryId: '1' }]) {
    writeFileSync(join(output, 'manifest.json'), JSON.stringify({ ...value, ...patch })); assert.throws(() => verifyManifest(context, output, root));
  }
  writeFileSync(join(output, 'manifest.json'), JSON.stringify(value));
  const path = join(output, value.packages[0].filename); writeFileSync(path, 'tampered');
  assert.throws(() => verifyManifest(context, output, root));
  value.packages[0].filename = '../secret.tgz'; writeFileSync(join(output, 'manifest.json'), JSON.stringify(value));
  assert.throws(() => verifyManifest(context, output, root));
}));
test('staging invokes only npm stage publish on the exact artifact in an isolated directory', async () => fixture(async ({ root, output, manifest }) => {
  const value = manifest(['@partylayer/core']); const calls = [];
  const receipt = await stage(context, output, apiFixture().api, { root, env: cleanEnv,
    state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: null }),
    execute: (command, args, cwd) => {
      calls.push({ command, args, cwd }); assert.ok(!cwd.startsWith(root));
      return JSON.stringify({ name: value.packages[0].name, version: '1.0.0', integrity: value.packages[0].integrity, stageId: 'stage-123' });
    },
  });
  assert.equal(calls.length, 1); assert.equal(calls[0].command, 'npm');
  assert.deepEqual(calls[0].args.slice(0, 2), ['stage', 'publish']);
  assert.equal(calls[0].args[2], join(output, value.packages[0].filename));
  assert.ok(calls[0].args.includes('--ignore-scripts')); assert.ok(calls[0].args.includes('--tag=latest'));
  assert.equal(existsSync(calls[0].cwd), false, 'temporary working directory cleaned');
  assert.equal(receipt.packages[0].status, 'staged-awaiting-owner-2fa');
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'stage-receipt.json'))), receipt);
}));
test('missing OIDC, npm-token fallback and changed owner selection/tag block all npm calls', async () => fixture(async ({ root, output, manifest }) => {
  manifest(['@partylayer/core']); let calls = 0;
  const options = { root, state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: null }), execute: () => { calls++; } };
  for (const env of [{ ...cleanEnv, ACTIONS_ID_TOKEN_REQUEST_TOKEN: '' }, { ...cleanEnv, NPM_TOKEN: 'TEST_ONLY' }, { ...cleanEnv, NODE_AUTH_TOKEN: 'TEST_ONLY' }, { ...cleanEnv, RELEASE_PACKAGES: '@partylayer/react' }, { ...cleanEnv, RELEASE_TAG: 'next' }]) await assert.rejects(stage(context, output, apiFixture().api, { ...options, env }));
  assert.equal(calls, 0);
}));
test('all registry state is checked before the first stage; published identical bytes are never resent', async () => fixture(async ({ root, output, manifest }) => {
  const value = manifest(['@partylayer/core']); let calls = 0;
  const options = { root, env: cleanEnv, execute: () => { calls++; } };
  for (const remote of [{ latestVersion: '0.9.1', publishedIntegrity: null }, { latestVersion: '0.9.0', publishedIntegrity: 'different' }]) await assert.rejects(stage(context, output, apiFixture().api, { ...options, state: async () => remote }));
  const receipt = await stage(context, output, apiFixture().api, { ...options, state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: value.packages[0].integrity }) });
  assert.equal(calls, 0); assert.equal(receipt.packages[0].status, 'already-published-identical');
}));
test('partial failures preserve receipts and stop without retry, approval or rejection', async () => fixture(async ({ root, output, manifest }) => {
  const value = manifest(['@partylayer/core', '@partylayer/sdk']); let calls = 0;
  await assert.rejects(stage(context, output, apiFixture().api, { root, env: { ...cleanEnv, RELEASE_PACKAGES: '@partylayer/core,@partylayer/sdk' },
    state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: null }),
    execute: () => { calls++; if (calls === 2) throw new Error('simulated failure'); return JSON.stringify({ name: value.packages[0].name, version: '1.0.0', integrity: value.packages[0].integrity, stageId: 'stage-1' }); },
  }));
  const receipt = JSON.parse(readFileSync(join(output, 'stage-receipt.json')));
  assert.equal(calls, 2); assert.deepEqual(receipt.packages.map(item => item.status), ['staged-awaiting-owner-2fa', 'unknown-stop-and-inspect']);
}));
test('package ordering places selected internal dependencies first and rejects cycles', () => {
  const map = new Map([['a', { dependencies: { b: '^1' } }], ['b', {}]]);
  assert.deepEqual(packageOrder(['a', 'b'], map), ['b', 'a']);
  map.set('b', { peerDependencies: { a: '^1' } }); assert.throws(() => packageOrder(['a', 'b'], map));
});
test('the real workflow isolates OIDC from builds and defaults to preparation only', () => {
  const workflow = parse(readFileSync(new URL('../../.github/workflows/npm-stage.yml', import.meta.url), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch.inputs.stage.default, false);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.prepare.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(workflow.jobs.stage.permissions, { contents: 'read', actions: 'read', 'id-token': 'write' });
  assert.equal(workflow.jobs.stage.environment.name, POLICY.environment);
  for (const job of Object.values(workflow.jobs)) {
    assert.ok(job.if.includes(`github.actor_id == '${POLICY.ownerId}'`));
    assert.ok(job.if.includes(`github.repository_id == '${POLICY.repositoryId}'`));
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^[a-zA-Z0-9_/-]+@[a-f0-9]{40}$/);
      if (step.uses?.startsWith('actions/setup-node@')) assert.equal(step.with['node-version'], POLICY.nodeVersion);
      if (step.uses?.startsWith('actions/checkout@')) {
        assert.equal(step.with.ref, '${{ github.sha }}'); assert.equal(step.with['persist-credentials'], false);
      }
      if (step.run) assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./, 'untrusted inputs must use environment variables, not shell interpolation');
    }
  }
  const stageCommands = workflow.jobs.stage.steps.filter(step => step.run).map(step => step.run).join('\n');
  assert.doesNotMatch(stageCommands, /pnpm|npm (?:publish|stage approve|stage reject|dist-tag)|npm (?:ci|install)(?! --global npm@)/);
  assert.ok(stageCommands.includes('owner-approved.mjs stage'));
  assert.ok(stageCommands.includes(`npm@${POLICY.npmVersion}`));
});

test('source-only prepublish hooks may be stripped, but package install hooks cannot be injected', async () => fixture(async ({ root, output, sources, pack }) => {
  const name = '@partylayer/core';
  const source = { ...sources.get(name), scripts: { build: 'tsc', prepublishOnly: 'reviewed-build' } };
  const versions = Object.fromEntries([...sources].map(([key, value]) => [key, value.version]));
  const item = pack(name, { scripts: { build: 'tsc' } });
  assert.doesNotThrow(() => inspectTarball(join(output, item.filename), source, versions, root));
  pack(name, { scripts: { build: 'tsc', postinstall: 'unexpected' } });
  assert.throws(() => inspectTarball(join(output, item.filename), source, versions, root));
}));
test('the isolated staging module loads without workspace dependencies or application code', async () => fixture(async ({ root }) => {
  const directory = join(root, 'standalone');
  mkdirSync(join(directory, 'scripts/release'), { recursive: true });
  mkdirSync(join(directory, '.github'));
  copyFileSync(new URL('./owner-approved.mjs', import.meta.url), join(directory, 'scripts/release/owner-approved.mjs'));
  writeFileSync(join(directory, '.github/npm-release-policy.json'), JSON.stringify(POLICY));
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', 'const module = await import(process.argv[1]); if(typeof module.stage !== "function") process.exit(1);', join(directory, 'scripts/release/owner-approved.mjs')], { cwd: directory, encoding: 'utf8' });
  assert.equal(result, '');
}));
