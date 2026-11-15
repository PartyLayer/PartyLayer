import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { POLICY, sourcePackages } from './owner-approved.mjs';
import { assertPublishingWorkflow, publishPreflight, publish, verifyPublicPackage, packageWaves } from './owner-publish.mjs';

const context = { repository: POLICY.repository, repositoryId: POLICY.repositoryId, actorId: POLICY.ownerId,
  triggeringActor: POLICY.ownerLogin, event: 'workflow_dispatch', ref: 'refs/heads/main', sha: 'a'.repeat(40),
  runId: '123', runAttempt: '1', actions: 'true', job: 'publish',
  workflowRef: `${POLICY.repository}/.github/workflows/${POLICY.publishWorkflow}@refs/heads/main` };
const cleanEnv = { RELEASE_PUBLISH: 'true', RELEASE_PACKAGES: '@partylayer/core', RELEASE_TAG: 'latest',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'TEST_ONLY' };
const digest = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
function registryClock() {
  let elapsed = 0;
  return { now: () => elapsed, sleep: async ms => { elapsed += ms; } };
}
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
async function fixture(fn, names = ['@partylayer/core'], configure = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'partylayer-publish-test-'));
  try {
    writeFileSync(join(root, 'LICENSE'), 'Test license');
    for (const [name, path] of Object.entries(POLICY.packages)) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: './dist/index.js' }));
      writeFileSync(join(root, path, 'README.md'), `# ${name}\n`);
    }
    // Give existing stop-before-dependent tests an actual selected dependency edge.
    const sdkPath = join(root, POLICY.packages['@partylayer/sdk'], 'package.json');
    const sdk = JSON.parse(readFileSync(sdkPath)); sdk.dependencies = { '@partylayer/core': '^1.0.0' };
    writeFileSync(sdkPath, JSON.stringify(sdk));
    mkdirSync(join(root, POLICY.packages['create-partylayer-app'], 'templates'), { recursive: true });
    configure(root);
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
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.map(p => p.status), ['publish-accepted-unverified']);
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
function deferred() {
  let resolve; const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function sourcePatch(root, name, values) {
  const file = join(root, POLICY.packages[name], 'package.json');
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file)), ...values }));
}

test('wave planning covers every selected target, rejects duplicates/unknowns/cycles, and preserves independent work', () => {
  const manifests = new Map([
    ['a', {}], ['b', { dependencies: { a: '^1' } }], ['c', {}],
    ['d', { optionalDependencies: { b: '^1' } }],
    ['e', { peerDependencies: { b: '^1' }, peerDependenciesMeta: { b: { optional: true } } }],
  ]);
  const names = ['d', 'c', 'e', 'a', 'b'];
  const waves = packageWaves(names, manifests);
  assert.deepEqual(waves, [['a', 'c'], ['b'], ['d', 'e']]);
  assert.deepEqual(waves.flat().sort(), [...names].sort());
  assert.throws(() => packageWaves(['a', 'a'], manifests), /Duplicate/);
  assert.throws(() => packageWaves(['missing'], manifests), /Unknown/);
  assert.throws(() => packageWaves([], manifests), /at least one/);
  manifests.get('a').dependencies = { d: '^1' };
  assert.throws(() => packageWaves(names, manifests), /cycle/);
});

test('wave planning includes shipped template dev dependencies and optional peers as barriers', async () => fixture(async ({ root }) => {
  const names = ['@partylayer/core', '@partylayer/registry-client', '@partylayer/session', 'create-partylayer-app'];
  assert.deepEqual(packageWaves(names, sourcePackages(root), root), [
    ['@partylayer/core'], ['@partylayer/registry-client'], ['@partylayer/session'], ['create-partylayer-app'],
  ]);
}, ['@partylayer/core'], root => {
  sourcePatch(root, '@partylayer/registry-client', { optionalDependencies: { '@partylayer/core': '^1.0.0' } });
  sourcePatch(root, '@partylayer/session', { peerDependencies: { '@partylayer/registry-client': '^1.0.0' }, peerDependenciesMeta: { '@partylayer/registry-client': { optional: true } } });
  const template = join(root, POLICY.packages['create-partylayer-app'], 'templates/test'); mkdirSync(template);
  writeFileSync(join(template, '_package.json'), JSON.stringify({ devDependencies: { '@partylayer/session': '^1.0.0' } }));
}));

test('writes stay serial and single-attempt; same-wave reads overlap and both block dependent writes', { timeout: 5_000 }, async () => fixture(async ({ output, options }) => {
  const first = deferred(), second = deferred(), readsStarted = deferred();
  const events = []; let readers = 0, maxReaders = 0, writes = 0;
  const running = publish(context, output, apiFixture(), { ...options,
    execute: (_command, args) => {
      assert.equal(readers, 0, 'A write must never overlap a verification read.'); writes++;
      const entry = JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.at(-1);
      assert.equal(entry.status, 'unknown-stop-and-inspect'); events.push(`write:${entry.name}`);
      assert.ok(args.includes('--provenance'));
    },
    verify: async item => {
      events.push(`read:${item.name}`);
      if (['@partylayer/registry-client', '@partylayer/provider'].includes(item.name)) {
        readers++; maxReaders = Math.max(maxReaders, readers);
        assert.equal(writes, 3, 'Every same-wave serial write must finish before its reads start.');
        const entries = JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages;
        assert.ok(entries.filter(entry => entry.name !== '@partylayer/core').every(entry => entry.status === 'publish-accepted-awaiting-verification'));
        if (readers === 2) readsStarted.resolve();
        await (item.name === '@partylayer/registry-client' ? first.promise : second.promise);
        readers--;
      }
    },
  });
  await readsStarted.promise; assert.equal(writes, 3); assert.equal(maxReaders, 2);
  first.resolve(); await new Promise(resolve => setImmediate(resolve)); assert.equal(writes, 3);
  second.resolve(); const receipt = await running;
  assert.equal(writes, 4); assert.ok(receipt.packages.every(entry => entry.status === 'published-verified'));
  assert.deepEqual(events.slice(0, 6), ['write:@partylayer/core', 'read:@partylayer/core', 'write:@partylayer/registry-client', 'write:@partylayer/provider', 'read:@partylayer/registry-client', 'read:@partylayer/provider']);
}, ['@partylayer/core', '@partylayer/registry-client', '@partylayer/provider', '@partylayer/sdk'], root => {
  sourcePatch(root, '@partylayer/registry-client', { dependencies: { '@partylayer/core': '^1.0.0' } });
  sourcePatch(root, '@partylayer/provider', { peerDependencies: { '@partylayer/core': '^1.0.0' } });
  sourcePatch(root, '@partylayer/sdk', { dependencies: { '@partylayer/registry-client': '^1.0.0', '@partylayer/provider': '^1.0.0' } });
}));

test('a write exception stops the wave immediately but settles accepted earlier writes and saves both outcomes', async () => fixture(async ({ output, options }) => {
  const writes = [], reads = [];
  await assert.rejects(publish(context, output, apiFixture(), { ...options,
    execute: () => {
      const entry = JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.at(-1);
      writes.push(entry.name); if (writes.length === 2) throw new Error('uncertain write');
    }, verify: async item => { reads.push(item.name); },
  }), /Publishing stopped/);
  assert.deepEqual(writes, ['@partylayer/core', '@partylayer/provider']);
  assert.deepEqual(reads, ['@partylayer/core']);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.map(entry => entry.status), ['published-verified', 'unknown-stop-and-inspect']);
}, ['@partylayer/core', '@partylayer/provider', '@partylayer/registry-client']));

test('a rejected verifier awaits another accepted verification, saves partial evidence, and blocks the next wave', { timeout: 5_000 }, async () => fixture(async ({ output, options }) => {
  const slow = deferred(), started = deferred(); let writes = 0, finished = false, directory;
  const running = publish(context, output, apiFixture(), { ...options,
    execute: (_command, _args, cwd) => { writes++; directory = cwd; },
    verify: async item => {
      if (item.name === '@partylayer/core') throw new Error('integrity mismatch');
      started.resolve(); await slow.promise;
    },
  });
  const rejected = assert.rejects(running, /Publishing stopped/).then(() => { finished = true; });
  await started.promise; await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false); assert.equal(writes, 2); assert.equal(existsSync(directory), true);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.map(entry => entry.status), ['publish-accepted-unverified', 'publish-accepted-awaiting-verification']);
  slow.resolve(); await rejected; assert.equal(writes, 2); assert.equal(existsSync(directory), false);
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'publish-receipt.json'))).packages.map(entry => entry.status), ['publish-accepted-unverified', 'published-verified']);
}, ['@partylayer/core', '@partylayer/registry-client', '@partylayer/sdk']));

test('an already-published wave is verified without writes and still precedes dependents', async () => fixture(async ({ output, manifest, options }) => {
  const reads = []; let writes = 0;
  const receipt = await publish(context, output, apiFixture(), { ...options,
    state: async name => ({ latestVersion: '0.9.0', publishedIntegrity: manifest.packages.find(item => item.name === name).integrity }),
    execute: () => { writes++; }, verify: async item => { reads.push(item.name); },
  });
  assert.equal(writes, 0); assert.deepEqual(reads, ['@partylayer/core', '@partylayer/sdk']);
  assert.deepEqual(receipt.packages.map(entry => entry.status), ['already-published-identical', 'already-published-identical']);
}, ['@partylayer/core', '@partylayer/sdk']));

test('every independent archive is snapshotted before the first same-wave write', async () => fixture(async ({ output, manifest, options }) => {
  let writes = 0;
  await publish(context, output, apiFixture(), { ...options, execute: (_command, args) => {
    const item = manifest.packages[writes++]; assert.equal(digest(readFileSync(args[1])), item.integrity);
    if (writes === 1) writeFileSync(join(output, manifest.packages[1].filename), 'later mutable original replaced');
  } });
  assert.equal(writes, 2);
}, ['@partylayer/core', '@partylayer/provider']));

test('public registry verification requires matching version, integrity and dist-tag', async () => {
  const item = { name: '@partylayer/core', version: '1.0.0', integrity: 'sha512-reviewed' };
  const good = { name: item.name, version: item.version, dist: { integrity: item.integrity } };
  const fetcher = async (url, opts) => { assert.ok(url.startsWith('https://registry.npmjs.org/%40partylayer%2Fcore/')); assert.equal(opts.redirect, 'error'); return Response.json(good); };
  await verifyPublicPackage(item, 'latest', fetcher);
  for (const value of [{ ...good, version: '0.9.0' }, { ...good, name: 'other' }, { ...good, dist: { integrity: 'different' } }]) await assert.rejects(verifyPublicPackage(item, 'next', async () => Response.json(value)));
  const clock = registryClock();
  await assert.rejects(verifyPublicPackage(item, 'latest', async () => new Response('', { status: 503 }), clock));
  assert.equal(clock.now(), 1_200_000);
});
test('registry propagation retries reads without issuing a second publication', async () => fixture(async ({ output, options }) => {
  let writes = 0, tagReads = 0;
  await publish(context, output, apiFixture(), { ...options, execute: () => { writes++; },
    verify: (item, tag) => verifyPublicPackage(item, tag, async url => {
      const stale = url.endsWith('/latest') && ++tagReads === 1;
      return Response.json({ name: item.name, version: stale ? '0.9.0' : item.version, dist: { integrity: item.integrity } });
    }, registryClock()),
  });
  assert.equal(writes, 1); assert.equal(tagReads, 2);
}));
test('asynchronous npm processing waits minutes for version and tag without republishing', async () => fixture(async ({ output, options }) => {
  let writes = 0, reads = 0;
  const clock = registryClock();
  const receipt = await publish(context, output, apiFixture(), { ...options, execute: () => { writes++; },
    verify: (item, tag) => verifyPublicPackage(item, tag, async url => {
      reads++;
      if (clock.now() < 190_000) return new Response('', { status: 404 });
      return Response.json({ name: item.name,
        version: url.endsWith('/latest') && clock.now() < 205_000 ? '0.9.0' : item.version,
        dist: { integrity: item.integrity } });
    }, clock),
  });
  assert.equal(writes, 1); assert.ok(reads > 70); assert.equal(clock.now(), 205_000);
  assert.equal(receipt.packages[0].status, 'published-verified');
}));
test('npm processing longer than five minutes still verifies the original single write', async () => fixture(async ({ output, options }) => {
  let writes = 0;
  const clock = registryClock();
  const receipt = await publish(context, output, apiFixture(), { ...options, execute: () => { writes++; },
    verify: (item, tag) => verifyPublicPackage(item, tag, async url => {
      if (clock.now() < 420_000) return new Response('', { status: 404 });
      return Response.json({ name: item.name,
        version: url.endsWith('/latest') && clock.now() < 435_000 ? '0.9.0' : item.version,
        dist: { integrity: item.integrity } });
    }, clock),
  });
  assert.equal(writes, 1);
  assert.equal(clock.now(), 435_000);
  assert.equal(receipt.packages[0].status, 'published-verified');
}));
test('propagation deadline bounds reads and never waits on immutable integrity failures', async () => {
  const item = { name: '@partylayer/core', version: '1.0.0', integrity: 'sha512-reviewed' };
  for (const status of [404, 429, 503]) {
    const clock = registryClock(); let reads = 0;
    await assert.rejects(verifyPublicPackage(item, 'latest', async () => { reads++; return new Response('', { status }); }, clock), /not available yet/);
    assert.equal(clock.now(), 1_200_000); assert.equal(reads, 482);
  }
  const clock = registryClock();
  await assert.rejects(verifyPublicPackage(item, 'latest', async () => Response.json({ ...item, dist: { integrity: 'different' } }), clock), /integrity differs/);
  assert.equal(clock.now(), 0);
});
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
  assert.ok(workflow.jobs.publish['timeout-minutes'] >= 19 * (2 + 5));
  assert.ok(workflow.jobs.publish['timeout-minutes'] <= 360);
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
