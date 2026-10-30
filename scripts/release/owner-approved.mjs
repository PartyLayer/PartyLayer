/** Owner-only preparation and staging. This module cannot approve a stage or publish directly. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const REGISTRY = 'https://registry.npmjs.org';
export const POLICY = JSON.parse(readFileSync(join(ROOT, '.github/npm-release-policy.json'), 'utf8'));
const digest = data => createHash('sha512').update(data).digest('base64');
const fail = message => { throw new Error(message); };
const read = path => JSON.parse(readFileSync(path, 'utf8'));
export function archiveBytes(path) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(descriptor);
    assert.ok(info.isFile(), 'Artifact must be a regular file.');
    assert.ok(info.size > 0 && info.size < 64 * 1024 * 1024, 'Unexpected archive size.');
    return readFileSync(descriptor);
  } finally { closeSync(descriptor); }
}
const run = (command, args, cwd = ROOT) => execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });

export function contextFrom(env = process.env) {
  return { repository: env.GITHUB_REPOSITORY, repositoryId: env.GITHUB_REPOSITORY_ID,
    actorId: env.GITHUB_ACTOR_ID, triggeringActor: env.GITHUB_TRIGGERING_ACTOR,
    event: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF, sha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, actions: env.GITHUB_ACTIONS,
    workflowRef: env.GITHUB_WORKFLOW_REF, job: env.GITHUB_JOB };
}
export function assertOwner(context, policy = POLICY) {
  assert.equal(context.actions, 'true', 'Release operations run only in GitHub Actions.');
  assert.equal(context.repository, policy.repository, 'Unexpected repository.');
  assert.equal(context.repositoryId, policy.repositoryId, 'Repository identity does not match.');
  assert.equal(context.actorId, policy.ownerId, 'Only the owner may initiate the release.');
  assert.equal(context.triggeringActor, policy.ownerLogin, 'Only the owner may rerun the release.');
  assert.equal(context.event, 'workflow_dispatch', 'Only manual dispatch is allowed.');
  assert.equal(context.ref, 'refs/heads/main', 'Only main may prepare a release.');
  assert.match(context.sha ?? '', /^[a-f0-9]{40}$/, 'An immutable source SHA is required.');
  assert.match(context.runId ?? '', /^[1-9][0-9]*$/);
  assert.match(context.runAttempt ?? '', /^[1-9][0-9]*$/);
}
export function selectPackages(input, policy = POLICY) {
  const names = input.split(',').map(name => name.trim());
  assert.ok(names.length && names.length <= Object.keys(policy.packages).length, 'Select at least one allowlisted package.');
  assert.equal(new Set(names).size, names.length, 'Duplicate package selection.');
  for (const name of names) assert.ok(Object.hasOwn(policy.packages, name), 'Package is not on the reviewed release allowlist.');
  return names;
}
export function githubClient(token, fetcher = fetch) {
  assert.ok(token, 'A read-only GitHub job token is required.');
  return async path => {
    const response = await fetcher(`https://api.github.com/repos/${POLICY.repository}/${path}`, {
      redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    });
    assert.equal(response.status, 200, 'GitHub release protection could not be verified.');
    return response.json();
  };
}
export async function preflight(context, api, policy = POLICY) {
  assertOwner(context, policy);
  const current = await api('git/ref/heads/main');
  assert.equal(current.object.sha, context.sha, 'main moved; dispatch a fresh release.');
  for (const workflow of policy.requiredWorkflows) {
    const response = await api(`actions/workflows/${workflow}/runs?branch=main&event=push&head_sha=${context.sha}&per_page=100`);
    const latest = response.workflow_runs.filter(item => item.head_sha === context.sha && item.event === 'push' && item.head_branch === 'main')
      .sort((a, b) => b.id - a.id)[0];
    assert.ok(latest && latest.status === 'completed' && latest.conclusion === 'success', `${workflow} must pass on the selected main commit.`);
  }
  const environment = await api(`environments/${policy.environment}`);
  assert.equal(environment.can_admins_bypass, false, 'Release approval must not permit admin bypass.');
  const reviewers = environment.protection_rules.filter(rule => rule.type === 'required_reviewers');
  assert.equal(reviewers.length, 1, 'An owner approval rule is required.');
  assert.equal(reviewers[0].prevent_self_review, false, 'The single owner must be able to approve their own dispatch.');
  assert.deepEqual(reviewers[0].reviewers.map(item => [item.type, String(item.reviewer.id)]), [['User', policy.ownerId]], 'The owner must be the only release reviewer.');
  assert.deepEqual(environment.deployment_branch_policy, { protected_branches: false, custom_branch_policies: true });
  const branches = await api(`environments/${policy.environment}/deployment-branch-policies`);
  assert.deepEqual(branches.branch_policies.map(item => [item.type, item.name]), [['branch', 'main']], 'Release environment must allow only main.');
}
async function registryJson(path, fetcher = fetch) {
  const response = await fetcher(`${REGISTRY}/${path}`, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) return null;
  assert.equal(response.status, 200, 'Registry metadata unavailable; stopping before staging.');
  return response.json();
}
export async function registryState(name, version, fetcher = fetch) {
  const encoded = encodeURIComponent(name);
  const latest = await registryJson(`${encoded}/latest`, fetcher);
  assert.ok(latest, 'Only existing packages may use this release workflow.');
  assert.deepEqual(latest.maintainers?.map(item => item.name).sort(), [POLICY.npmMaintainer], 'Public maintainer metadata changed; review effective npm permissions before staging.');
  const published = await registryJson(`${encoded}/${encodeURIComponent(version)}`, fetcher);
  return { latestVersion: latest.version, publishedIntegrity: published?.dist?.integrity ?? null };
}
function targets(manifest) {
  const values = [];
  const walk = value => {
    if (typeof value === 'string') values.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(manifest.exports);
  for (const key of ['main', 'module', 'types', 'typings', 'bin']) walk(manifest[key]);
  return values.filter(value => !value.includes('*')).map(value => `package/${value.replace(/^\.\//, '')}`);
}
export function inspectTarball(path, source, versions, root = ROOT) {
  archiveBytes(path); // Validate one no-follow descriptor before invoking tar.
  const entries = run('tar', ['-tzf', path]).trim().split('\n');
  assert.equal(new Set(entries).size, entries.length, 'Duplicate archive entries.');
  for (const entry of entries) {
    assert.match(entry, /^package\/[a-zA-Z0-9_@+./-]*$/, 'Unexpected archive path.');
    assert.ok(!entry.split('/').includes('..'), 'Archive path traversal.');
    assert.ok(!entry.split('/').some(part => part.startsWith('.env') || part === '.npmrc'), 'Credential/config files must not ship.');
  }
  const modes = run('tar', ['-tvzf', path]).trim().split('\n');
  assert.ok(modes.every(line => line.startsWith('-') || line.startsWith('d')), 'Links and special archive entries are forbidden.');
  const extract = name => execFileSync('tar', ['-xOzf', path, `package/${name}`], { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  const packed = JSON.parse(extract('package.json').toString());
  assert.ok(packed.private === undefined || packed.private === false, 'Private packages are not release candidates.');
  assert.equal(packed.name, source.name); assert.equal(packed.version, source.version);
  assert.ok(!packed.publishConfig || Object.keys(packed.publishConfig).length === 0, 'Review publishConfig before allowing overrides into staging.');
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const expected = Object.fromEntries(Object.entries(source[field] ?? {}).map(([name, range]) => {
      if (!range.startsWith('workspace:')) return [name, range];
      assert.ok(versions[name], 'Unknown workspace dependency.');
      const suffix = range.slice('workspace:'.length);
      assert.ok(['*', '^', '~'].includes(suffix), 'Review this workspace protocol before release.');
      return [name, suffix === '*' ? versions[name] : suffix + versions[name]];
    }));
    assert.deepEqual(packed[field] ?? {}, expected, `${field} differ from the source/pnpm rewrite.`);
  }
  // pnpm 9 removes the source-only prepublishOnly hook from the packed manifest.
  const scripts = { ...source.scripts }; delete scripts.prepublishOnly;
  assert.deepEqual(packed.scripts ?? {}, scripts, 'Packed scripts differ from reviewed source.');
  for (const field of ['exports', 'main', 'module', 'types', 'typings', 'bin', 'type', 'sideEffects', 'engines', 'peerDependenciesMeta', 'files', 'browser', 'imports', 'license']) assert.deepEqual(packed[field], source[field], `${field} differ from the reviewed source.`);
  for (const target of targets(packed)) assert.ok(entries.includes(target), 'Declared entry point missing from archive.');
  assert.deepEqual(extract('README.md'), readFileSync(join(root, POLICY.packages[source.name], 'README.md')), 'Packaged README differs from source.');
  assert.deepEqual(extract('LICENSE'), readFileSync(join(root, 'LICENSE')), 'Packaged license differs from source.');
  return packed;
}
export function sourcePackages(root = ROOT) {
  return new Map(Object.entries(POLICY.packages).map(([name, path]) => {
    const manifest = read(join(root, path, 'package.json'));
    assert.equal(manifest.name, name); assert.ok(!manifest.private);
    return [name, manifest];
  }));
}
/** Include dependencies inside shipped starter manifests, not just the CLI's own runtime. */
export function releaseDependencies(name, manifest, packages, root = ROOT) {
  const dependencies = new Set(Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }));
  if (name === 'create-partylayer-app') {
    const templates = join(root, POLICY.packages[name], 'templates');
    for (const entry of readdirSync(templates, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(templates, entry.name, '_package.json');
      if (!existsSync(path)) continue;
      const template = read(path);
      for (const dependency of Object.keys({ ...template.dependencies, ...template.devDependencies, ...template.peerDependencies })) {
        if (!dependency.startsWith('@partylayer/')) continue;
        assert.ok(packages.has(dependency), 'Unknown internal starter dependency.');
        dependencies.add(dependency);
      }
    }
  }
  return dependencies;
}
export async function assertPublishedDependencies(names, packages, state = registryState, root = ROOT) {
  const checked = new Set();
  for (const name of names) {
    for (const dependency of releaseDependencies(name, packages.get(name), packages, root)) {
      if (!packages.has(dependency) || names.includes(dependency) || checked.has(dependency)) continue;
      const published = await state(dependency, packages.get(dependency).version);
      assert.ok(published.publishedIntegrity, 'An internal dependency or shipped starter dependency is unpublished; include it in the coordinated release.');
      checked.add(dependency);
    }
  }
}
export function packageOrder(names, manifests, root = ROOT) {
  const ordered = [], visiting = new Set(), done = new Set();
  const visit = name => {
    if (done.has(name)) return;
    assert.ok(!visiting.has(name), 'Release dependency cycle.'); visiting.add(name);
    const manifest = manifests.get(name);
    for (const dependency of releaseDependencies(name, manifest, manifests, root)) if (names.includes(dependency)) visit(dependency);
    visiting.delete(name); done.add(name); ordered.push(name);
  };
  names.forEach(visit); return ordered;
}
export async function prepare(context, input, directory, tag, api, state = registryState) {
  await preflight(context, api);
  assert.ok(['latest', 'next'].includes(tag), 'Only reviewed dist-tags may be selected.');
  assert.equal(run('git', ['rev-parse', 'HEAD']).trim(), context.sha);
  assert.equal(run('git', ['status', '--porcelain', '--untracked-files=no']).trim(), '', 'Tracked source files changed.');
  const packages = sourcePackages();
  const names = packageOrder(selectPackages(input), packages);
  await assertPublishedDependencies(names, packages, state);
  const versions = Object.fromEntries([...packages].map(([name, manifest]) => [name, manifest.version]));
  const semver = (await import('semver')).default;
  mkdirSync(directory, { recursive: true });
  assert.ok(!existsSync(join(directory, 'manifest.json')), 'Use a fresh release artifact directory.');
  const manifest = { schemaVersion: 1, repositoryId: context.repositoryId, sourceSha: context.sha, runId: context.runId, runAttempt: context.runAttempt, tag, packages: [] };
  for (const name of names) {
    const source = packages.get(name);
    assert.ok(semver.valid(source.version), 'Invalid package version.');
    assert.ok(tag !== 'latest' || !semver.prerelease(source.version), 'Prereleases require next.');
    const before = new Set(readdirSync(directory));
    run('pnpm', ['pack', '--pack-destination', directory], join(ROOT, POLICY.packages[name]));
    const added = readdirSync(directory).filter(file => !before.has(file));
    assert.equal(added.length, 1, 'Expected exactly one pnpm tarball.');
    const filename = added[0]; assert.match(filename, /^[a-zA-Z0-9_.-]+\.tgz$/);
    inspectTarball(join(directory, filename), source, versions);
    const integrity = `sha512-${digest(readFileSync(join(directory, filename)))}`;
    const remote = await state(name, source.version);
    assert.ok(!remote.publishedIntegrity || remote.publishedIntegrity === integrity, 'Version already published with different bytes.');
    assert.ok(tag !== 'latest' || semver.gte(source.version, remote.latestVersion), 'Refusing to move latest backwards.');
    manifest.packages.push({ name, version: source.version, filename, integrity, latestVersion: remote.latestVersion });
  }
  assert.equal(run('git', ['status', '--porcelain', '--untracked-files=no']).trim(), '', 'Packaging changed tracked source.');
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export function verifyManifest(context, directory, root = ROOT) {
  assertOwner(context);
  const manifest = read(join(directory, 'manifest.json'));
  assert.equal(manifest.schemaVersion, 1);
  for (const [key, value] of Object.entries({ repositoryId: context.repositoryId, sourceSha: context.sha, runId: context.runId, runAttempt: context.runAttempt })) assert.equal(manifest[key], value, 'Artifact source/run identity does not match.');
  assert.ok(['latest', 'next'].includes(manifest.tag));
  assert.ok(Array.isArray(manifest.packages) && manifest.packages.length > 0);
  const names = selectPackages(manifest.packages.map(item => item.name).join(','));
  const sources = sourcePackages(root), versions = Object.fromEntries([...sources].map(([name, pkg]) => [name, pkg.version]));
  assert.deepEqual(names, packageOrder(names, sources, root), 'Artifact package order changed.');
  for (const item of manifest.packages) {
    assert.match(item.filename, /^[a-zA-Z0-9_.-]+\.tgz$/);
    assert.match(item.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
    const path = join(directory, item.filename);
    assert.equal(`sha512-${digest(archiveBytes(path))}`, item.integrity, 'Archive integrity changed.');
    assert.equal(item.version, sources.get(item.name).version);
    inspectTarball(path, sources.get(item.name), versions, root);
  }
  return manifest;
}
export async function stage(context, directory, api, { state = registryState, execute = run, env = process.env, root = ROOT } = {}) {
  await preflight(context, api);
  assert.ok(env.ACTIONS_ID_TOKEN_REQUEST_URL && env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'OIDC is required; there is no npm-token fallback.');
  assert.ok(!env.NODE_AUTH_TOKEN && !env.NPM_TOKEN, 'Long-lived npm tokens are forbidden in this job.');
  const manifest = verifyManifest(context, directory, root);
  assert.deepEqual(manifest.packages.map(item => item.name), packageOrder(selectPackages(env.RELEASE_PACKAGES ?? ''), sourcePackages(root), root), 'Artifact selection differs from owner dispatch.');
  assert.equal(manifest.tag, env.RELEASE_TAG, 'Artifact tag differs from owner dispatch.');
  const pending = [];
  for (const item of manifest.packages) {
    const remote = await state(item.name, item.version);
    assert.equal(remote.latestVersion, item.latestVersion, 'Registry latest changed; prepare a fresh release.');
    assert.ok(!remote.publishedIntegrity || remote.publishedIntegrity === item.integrity, 'Published bytes differ; manual investigation required.');
    pending.push({ ...item, alreadyPublished: remote.publishedIntegrity === item.integrity });
  }
  const receipt = { sourceSha: context.sha, runId: context.runId, runAttempt: context.runAttempt, packages: [] };
  const save = () => writeFileSync(join(directory, 'stage-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  save();
  const isolated = mkdtempSync(join(tmpdir(), 'partylayer-npm-stage-'));
  try {
  for (const item of pending) {
    if (item.alreadyPublished) continue;
    const bytes = archiveBytes(resolve(directory, item.filename));
    assert.equal(`sha512-${digest(bytes)}`, item.integrity, 'Archive changed after validation.');
    writeFileSync(join(isolated, item.filename), bytes, { flag: 'wx', mode: 0o400 });
  }
  for (const item of pending) {
    if (item.alreadyPublished) { receipt.packages.push({ name: item.name, version: item.version, status: 'already-published-identical' }); save(); continue; }
    try {
      const output = execute('npm', ['stage', 'publish', join(isolated, item.filename), `--registry=${REGISTRY}`, '--access=public', `--tag=${manifest.tag}`, '--ignore-scripts', '--json'], isolated);
      const parsed = JSON.parse(output);
      const result = Array.isArray(parsed) ? parsed[0] : (parsed.stageId ? parsed : parsed[item.name]);
      assert.match(result?.stageId ?? '', /^[a-zA-Z0-9_.:-]{1,256}$/, 'Registry did not return a stage ID; inspect the run before retrying.');
      assert.equal(result.name, item.name); assert.equal(result.version, item.version); assert.equal(result.integrity, item.integrity, 'npm staged different bytes.');
      receipt.packages.push({ name: item.name, version: item.version, integrity: item.integrity, stageId: result.stageId, status: 'staged-awaiting-owner-2fa' }); save();
    } catch {
      receipt.packages.push({ name: item.name, version: item.version, status: 'unknown-stop-and-inspect' }); save();
      fail('Staging stopped. Preserve the receipt and inspect npm stages with the owner account before retrying; no automatic approval or rejection was attempted.');
    }
  }
  return receipt;
  } finally { rmSync(isolated, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const context = contextFrom(); const [command, directory] = process.argv.slice(2);
    const api = githubClient(process.env.GH_TOKEN);
    if (command === 'preflight') await preflight(context, api);
    else if (command === 'prepare') await prepare(context, process.env.RELEASE_PACKAGES ?? '', resolve(directory), process.env.RELEASE_TAG ?? 'latest', api);
    else if (command === 'stage') await stage(context, resolve(directory), api);
    else fail('Use preflight, prepare or stage.');
    console.log('Owner release checks completed. Staged packages still require the owner\'s npm 2FA approval.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
