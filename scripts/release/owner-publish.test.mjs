import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { POLICY } from './owner-approved.mjs';
import { assertPublishingWorkflow, publishPreflight, publish, verifyPublicPackage } from './owner-publish.mjs';

const context = { repository: POLICY.repository, repositoryId: POLICY.repositoryId, actorId: POLICY.ownerId,
  triggeringActor: POLICY.ownerLogin, event: 'workflow_dispatch', ref: 'refs/heads/main', sha: 'a'.repeat(40),
  runId: '123', runAttempt: '1', actions: 'true', job: 'publish',
  workflowRef: `${POLICY.repository}/.github/workflows/${POLICY.publishWorkflow}@refs/heads/main` };
const cleanEnv = { RELEASE_PUBLISH: 'true', RELEASE_PACKAGES: '@partylayer/core', RELEASE_TAG: 'latest',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'TEST_ONLY' };
const digest = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
function apiFixture(change = () => {}) {
  const response = {
    'git/ref/heads/main': { object: { sha: context.sha } },
    [`environments/${POLICY.environment}`]: { can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: false, reviewers: [{ type: 'User', reviewer: { id: Number(POLICY.ownerId) } }] }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } },
    [`environments/${POLICY.environment}/deployment-branch-policies`]: { branch_policies: [{ type: 'branch', name: 'main' }] },
    'code-scanning/alerts?state=open&ref=refs/heads/main&per_page=1': [],
  };
  for (const workflow of POLICY.requiredWorkflows) response[`actions/workflows/${workflow}/runs?branch=main&event=push&head_sha=${context.sha}&per_page=100`] = { workflow_runs: [{ id: 10, head_sha: context.sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success' }] };
  change(response);
  return async path => { assert.ok(response[path], path); return structuredClone(response[path]); };
}
async function fixture(fn, names = ['@partylayer/core']) {
  const root = mkdtempSync(join(tmpdir(), 'partylayer-publish-test-'));
  try {
    writeFileSync(join(root, 'LICENSE'), 'Test license');
    for (const [name, path] of Object.entries(POLICY.packages)) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: './dist/index.js' }));
      writeFileSync(join(root, path, 'README.md'), `# ${name}\n`);
    }
    const output = join(root, 'output'); mkdirSync(output);
    const packages = names.map((name, index) => {
      const payload = join(root, `payload-${index}`); mkdirSync(join(payload, 'package/dist'), { recursive: true });
      copyFileSync(join(root, POLICY.packages[name], 'package.json'), join(payload, 'package/package.json'));
      copyFileSync(join(root, POLICY.packages[name], 'README.md'), join(payload, 'package/README.md'));
      copyFileSync(join(root, 'LICENSE'), join(payload, 'package/LICENSE'));
      writeFileSync(join(payload, 'package/dist/index.js'), "throw new Error('package code must not run during publishing');");
      const filename = `package-${index}.tgz`; execFileSync('tar', ['-czf', join(output, filename), '-C', payload, 'package']);
      return { name, version: '1.0.0', filename, integrity: digest(readFileSync(join(output, filename))), latestVersion: '0.9.0' };
    });
    const manifest = { schemaVersion: 1, repositoryId: context.repositoryId, sourceSha: context.sha, runId: context.runId, runAttempt: context.runAttempt, tag: 'latest', packages };
    const saveManifest = () => writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest)); saveManifest();
    const options = { root, env: { ...cleanEnv, RELEASE_PACKAGES: names.join(',') },
      state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: null }), verify: async () => {} };
    await fn({ root, output, manifest, saveManifest, options });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('direct publishing accepts only the reviewed main-branch workflow', () => {
  assert.doesNotThrow(() => assertPublishingWorkflow(context));
  for (const workflowRef of [undefined, context.workflowRef.replace('main', 'feature'), context.workflowRef.replace('npm-publish.yml', 'npm-stage.yml'), context.workflowRef.replace('PartyLayer/PartyLayer', 'attacker/fork')]) assert.throws(() => assertPublishingWorkflow({ ...context, workflowRef }));
});
test('publisher requires all four main checks and no unreviewed code-scanning findings', async () => {
  assert.deepEqual(POLICY.requiredWorkflows, ['ci.yml', 'regression-gate.yml', 'browser-compatibility.yml', 'codeql.yml']);
  await publishPreflight(context, apiFixture());
  for (const change of [
    data => { data['code-scanning/alerts?state=open&ref=refs/heads/main&per_page=1'] = [{ number: 1 }]; },
    data => { data['code-scanning/alerts?state=open&ref=refs/heads/main&per_page=1'] = {}; },
    data => { Object.values(data).find(value => value.workflow_runs).workflow_runs[0].conclusion = 'failure'; },
    data => { data['git/ref/heads/main'].object.sha = 'b'.repeat(40); },
    data => { data[`environments/${POLICY.environment}`].can_admins_bypass = true; },
  ]) await assert.rejects(publishPreflight(context, apiFixture(change)));
});
test('only the protected publish job, explicit selection and OIDC can write', async () => fixture(async ({ output, options }) => {
  let writes = 0; const execute = () => { writes++; };
  for (const patch of [{ actorId: '1' }, { repositoryId: '1' }, { triggeringActor: 'cayvox' }, { event: 'pull_request' }, { job: 'prepare' }, { workflowRef: 'wrong' }]) await assert.rejects(publish({ ...context, ...patch }, output, apiFixture(), { ...options, execute }));
  for (const patch of [{ RELEASE_PUBLISH: '' }, { RELEASE_PUBLISH: 'false' }, { ACTIONS_ID_TOKEN_REQUEST_TOKEN: '' }, { NPM_TOKEN: 'TEST_ONLY' }, { NODE_AUTH_TOKEN: 'TEST_ONLY' }, { NPM_AUTH_TOKEN: 'TEST_ONLY' }, { npm_config_otp: 'TEST_ONLY' }, { RELEASE_PACKAGES: '@partylayer/react' }, { RELEASE_TAG: 'next' }]) await assert.rejects(publish(context, output, apiFixture(), { ...options, env: { ...options.env, ...patch }, execute }));
  assert.equal(writes, 0);
}));
test('publication uses the exact private snapshot, empty configs, no lifecycle and provenance', async () => fixture(async ({ output, manifest, options }) => {
  let writes = 0, checked = 0, directory;
  const receipt = await publish(context, output, apiFixture(), { ...options,
    env: { ...options.env, NPM_CONFIG_REGISTRY: 'https://evil.invalid', NPM_CONFIG_PROVENANCE: 'false' },
    execute: (command, args, cwd, env) => {
      writes++; directory = cwd;
      assert.equal(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages[0].status, 'unknown-stop-and-inspect');
      assert.equal(command, 'npm'); assert.equal(args[0], 'publish');
      assert.equal(dirname(args[1]), cwd); assert.equal(digest(readFileSync(args[1])), manifest.packages[0].integrity);
      writeFileSync(join(output, manifest.packages[0].filename), 'mutable original replaced');
      assert.equal(digest(readFileSync(args[1])), manifest.packages[0].integrity);
      assert.ok(args.includes('--ignore-scripts')); assert.ok(args.includes('--provenance')); assert.ok(args.includes('--tag=latest'));
      assert.ok(args.includes('--registry=https://registry.npmjs.org')); assert.ok(!args.includes('stage'));
      assert.equal(readFileSync(env.NPM_CONFIG_USERCONFIG, 'utf8'), ''); assert.equal(readFileSync(env.NPM_CONFIG_GLOBALCONFIG, 'utf8'), '');
      assert.equal(env.NPM_CONFIG_REGISTRY, undefined); assert.equal(env.NPM_CONFIG_PROVENANCE, undefined);
    },
    verify: async (item, tag) => { checked++; assert.equal(item.name, '@partylayer/core'); assert.equal(tag, 'latest'); },
  });
  assert.equal(writes, 1); assert.equal(checked, 1); assert.equal(existsSync(directory), false);
  assert.equal(receipt.packages[0].status, 'published-verified');
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))), receipt);
}));
test('all selected registry state is validated before the first write', async () => fixture(async ({ output, options }) => {
  let writes = 0;
  await assert.rejects(publish(context, output, apiFixture(), { ...options, execute: () => { writes++; },
    state: async name => ({ latestVersion: name === '@partylayer/sdk' ? '0.9.1' : '0.9.0', publishedIntegrity: null }),
  }), /Registry latest changed/);
  assert.equal(writes, 0);
}, ['@partylayer/core', '@partylayer/sdk']));
test('already published identical versions are checked and never republished or silently retagged', async () => fixture(async ({ output, manifest, options }) => {
  let writes = 0; const settings = { ...options, state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: manifest.packages[0].integrity }), execute: () => { writes++; } };
  const receipt = await publish(context, output, apiFixture(), settings);
  assert.equal(receipt.packages[0].status, 'already-published-identical');
  await assert.rejects(publish(context, output, apiFixture(), { ...settings, verify: async () => { throw new Error('wrong dist-tag'); } }), /wrong dist-tag/);
  await assert.rejects(publish(context, output, apiFixture(), { ...settings, state: async () => ({ latestVersion: '0.9.0', publishedIntegrity: 'different' }) }), /Published bytes differ/);
  assert.equal(writes, 0);
}));
test('post-write uncertainty preserves the receipt and never retries or sends later packages', async () => fixture(async ({ output, options }) => {
  let writes = 0;
  await assert.rejects(publish(context, output, apiFixture(), { ...options, execute: () => { writes++; }, verify: async () => { throw new Error('registry temporarily unavailable'); } }), /Publishing stopped/);
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.map(p => p.status), ['unknown-stop-and-inspect']);
}, ['@partylayer/core', '@partylayer/sdk']));
test('a partial publication keeps successful results and stops on the first failed write', async () => fixture(async ({ output, options }) => {
  let writes = 0;
  await assert.rejects(publish(context, output, apiFixture(), { ...options, execute: () => { if (++writes === 2) throw new Error('uncertain network write'); } }), /Publishing stopped/);
  assert.equal(writes, 2);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.map(p => p.status), ['published-verified', 'unknown-stop-and-inspect']);
}, ['@partylayer/core', '@partylayer/sdk']));
test('archive tampering after validation stops every write', async () => fixture(async ({ output, manifest, options }) => {
  let writes = 0;
  await assert.rejects(publish(context, output, apiFixture(), { ...options, execute: () => { writes++; },
    state: async () => { writeFileSync(join(output, manifest.packages[0].filename), 'tampered'); return { latestVersion: '0.9.0', publishedIntegrity: null }; },
  }), /Archive changed after validation/);
  assert.equal(writes, 0);
}));
test('public registry verification requires matching version, integrity and dist-tag', async () => {
  const item = { name: '@partylayer/core', version: '1.0.0', integrity: 'sha512-reviewed' };
  const good = { name: item.name, version: item.version, dist: { integrity: item.integrity } };
  const fetcher = async (url, opts) => { assert.ok(url.startsWith('https://registry.npmjs.org/%40partylayer%2Fcore/')); assert.equal(opts.redirect, 'error'); return Response.json(good); };
  await verifyPublicPackage(item, 'latest', fetcher);
  for (const value of [{ ...good, version: '0.9.0' }, { ...good, name: 'other' }, { ...good, dist: { integrity: 'different' } }]) await assert.rejects(verifyPublicPackage(item, 'next', async () => Response.json(value)));
  await assert.rejects(verifyPublicPackage(item, 'latest', async () => new Response('', { status: 503 })));
});
test('registry propagation retries reads without issuing a second publication', async () => fixture(async ({ output, options }) => {
  let writes = 0, tagReads = 0;
  await publish(context, output, apiFixture(), { ...options, execute: () => { writes++; },
    verify: (item, tag) => verifyPublicPackage(item, tag, async url => {
      const stale = url.endsWith('/latest') && ++tagReads === 1;
      return Response.json({ name: item.name, version: stale ? '0.9.0' : item.version, dist: { integrity: item.integrity } });
    }),
  });
  assert.equal(writes, 1); assert.equal(tagReads, 2);
}));
test('publishing module imports in an empty directory without application dependencies', async () => fixture(async ({ root }) => {
  const isolated = join(root, 'standalone'); mkdirSync(join(isolated, 'scripts/release'), { recursive: true }); mkdirSync(join(isolated, '.github'));
  for (const file of ['owner-approved.mjs', 'owner-publish.mjs']) copyFileSync(new URL(file, import.meta.url), join(isolated, 'scripts/release', file));
  writeFileSync(join(isolated, '.github/npm-release-policy.json'), JSON.stringify(POLICY));
  writeFileSync(join(isolated, 'consumer.mjs'), 'import { publish } from "./scripts/release/owner-publish.mjs"; if (typeof publish !== "function") process.exit(1);');
  assert.equal(execFileSync(process.execPath, [join(isolated, 'consumer.mjs')], { cwd: isolated, encoding: 'utf8' }), '');
}));
test('real publishing workflow has one protected owner gate and defaults to no publication', () => {
  const workflow = parse(readFileSync(new URL('../../.github/workflows/npm-publish.yml', import.meta.url), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']); assert.equal(workflow.on.workflow_dispatch.inputs.publish.default, false);
  assert.equal(workflow.concurrency.group, 'owner-approved-npm-release'); assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.prepare.permissions, { contents: 'read', actions: 'read', 'security-events': 'read' });
  assert.deepEqual(workflow.jobs.publish.permissions, { contents: 'read', actions: 'read', 'security-events': 'read', 'id-token': 'write' });
  assert.equal(workflow.jobs.prepare.environment, undefined); assert.equal(workflow.jobs.publish.environment.name, POLICY.environment);
  assert.equal(workflow.jobs.publish.needs, 'prepare'); assert.ok(workflow.jobs.publish.if.includes('inputs.publish == true'));
  for (const job of Object.values(workflow.jobs)) {
    for (const check of [`github.actor_id == '${POLICY.ownerId}'`, `github.repository_id == '${POLICY.repositoryId}'`, `github.triggering_actor == '${POLICY.ownerLogin}'`, "github.ref == 'refs/heads/main'"]) assert.ok(job.if.includes(check));
    for (const step of job.steps) {
      if (step.uses) assert.match(step.uses, /^[a-zA-Z0-9_/-]+@[a-f0-9]{40}$/);
      if (step.uses?.startsWith('actions/checkout@')) { assert.equal(step.with.ref, '${{ github.sha }}'); assert.equal(step.with['persist-credentials'], false); }
      if (step.uses?.startsWith('actions/setup-node@')) assert.equal(step.with['node-version'], POLICY.nodeVersion);
      if (step.run) assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./);
    }
  }
  const commands = workflow.jobs.publish.steps.filter(s => s.run).map(s => s.run).join('\n');
  assert.doesNotMatch(commands, /pnpm|npm (?:stage|dist-tag)|npm (?:ci|install)(?! --global npm@)/);
  assert.ok(commands.includes('owner-publish.mjs publish')); assert.ok(commands.includes(`npm@${POLICY.npmVersion}`));
});

test('required browser evidence runs on every main push without path omissions', () => {
  const browser = parse(readFileSync(new URL('../../.github/workflows/browser-compatibility.yml', import.meta.url), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(browser.on.push, { branches: ['main'] });
});
