/** Publish exact reviewed files only from the owner's protected GitHub job. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { POLICY, REGISTRY, archiveBytes, contextFrom, githubClient, preflight, verifyManifest,
  selectPackages, packageOrder, releaseDependencies, sourcePackages, registryState } from './owner-approved.mjs';

export function assertPublishingWorkflow(context) {
  assert.equal(context.workflowRef, `${POLICY.repository}/.github/workflows/${POLICY.publishWorkflow}@refs/heads/main`, 'Only the reviewed publishing workflow may publish.');
}
export async function publishPreflight(context, api) {
  assertPublishingWorkflow(context);
  await preflight(context, api);
  const alerts = await api('code-scanning/alerts?state=open&ref=refs/heads/main&per_page=1');
  assert.ok(Array.isArray(alerts) && alerts.length === 0, 'Review open main-branch code-scanning alerts before publishing.');
}

/** Read-only retries cover registry propagation; immutable integrity mismatches stop immediately. */
export async function verifyPublicPackage(item, tag, fetcher = fetch, {
  now = () => performance.now(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 1_200_000, pollMs = 5_000,
} = {}) {
  const deadline = now() + timeoutMs;
  const transient = message => Object.assign(new Error(message), { retryable: true });
  const request = async suffix => {
    const response = await fetcher(`${REGISTRY}/${encodeURIComponent(item.name)}/${encodeURIComponent(suffix)}`, {
      redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(8_000, Math.ceil(deadline - now())))),
    });
    if ([404, 429].includes(response.status) || response.status >= 500) throw transient('Published registry metadata is not available yet.');
    assert.equal(response.status, 200, 'Published registry metadata is unavailable; inspect before retrying.');
    return response.json();
  };
  for (;;) {
    try {
      const [version, tagged] = await Promise.all([request(item.version), request(tag)]);
      assert.equal(version.name, item.name); assert.equal(version.version, item.version);
      assert.equal(version.dist?.integrity, item.integrity, 'Public registry integrity differs from the reviewed file.');
      assert.equal(tagged.name, item.name);
      if (tagged.version !== item.version) throw transient('Published dist-tag has not propagated to the reviewed version.');
      assert.equal(tagged.dist?.integrity, item.integrity, 'Public registry integrity differs from the reviewed file.');
      return;
    } catch (error) {
      const remaining = deadline - now();
      if (!error.retryable || remaining <= 0) throw error;
      await sleep(Math.min(pollMs, remaining));
    }
  }
}

/** Selected dependencies, including starter/optional/peer edges, must finish a prior wave. */
export function packageWaves(names, manifests, root) {
  assert.ok(Array.isArray(names) && names.length > 0, 'Select at least one release target.');
  assert.equal(new Set(names).size, names.length, 'Duplicate release target.');
  for (const name of names) assert.ok(manifests.has(name), 'Unknown release target.');
  const remaining = new Set(packageOrder(names, manifests, root));
  const waves = [];
  while (remaining.size) {
    const wave = [...remaining].filter(name => [...releaseDependencies(name, manifests.get(name), manifests, root)]
      .every(dependency => !remaining.has(dependency)));
    assert.ok(wave.length > 0, 'Release dependency cycle.');
    waves.push(wave);
    for (const name of wave) remaining.delete(name);
  }
  assert.equal(waves.flat().length, names.length, 'Wave plan omitted a release target.');
  return waves;
}

const executeNpm = (command, args, cwd, env) => execFileSync(command, args, {
  cwd, env, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
});
const integrity = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

export async function publish(context, directory, api, {
  state = registryState, verify = verifyPublicPackage, execute = executeNpm, env = process.env, root,
} = {}) {
  assert.equal(context.job, 'publish', 'Only the environment-protected publishing job may publish.');
  assert.equal(env.RELEASE_PUBLISH, 'true', 'Publishing must be explicitly selected; preparation is the default.');
  await publishPreflight(context, api);
  assert.ok(env.ACTIONS_ID_TOKEN_REQUEST_URL && env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'GitHub OIDC is required.');
  for (const key of ['NODE_AUTH_TOKEN', 'NPM_TOKEN', 'NPM_AUTH_TOKEN', 'NPM_CONFIG_OTP', 'NPM_CONFIG__AUTH', 'NPM_CONFIG__AUTHTOKEN']) {
    assert.ok(!env[key] && !env[key.toLowerCase()], 'Traditional authentication and OTP fallback are forbidden.');
  }
  const manifest = verifyManifest(context, directory, root);
  const sources = sourcePackages(root);
  assert.deepEqual(manifest.packages.map(item => item.name), packageOrder(selectPackages(env.RELEASE_PACKAGES ?? ''), sources, root), 'Artifact selection differs from owner dispatch.');
  const waves = packageWaves(manifest.packages.map(item => item.name), sources, root);
  assert.equal(manifest.tag, env.RELEASE_TAG, 'Artifact tag differs from owner dispatch.');
  const pending = [];
  for (const item of manifest.packages) {
    const remote = await state(item.name, item.version);
    assert.equal(remote.latestVersion, item.latestVersion, 'Registry latest changed; prepare a fresh release.');
    assert.ok(!remote.publishedIntegrity || remote.publishedIntegrity === item.integrity, 'Published bytes differ; inspect before retrying.');
    const alreadyPublished = remote.publishedIntegrity === item.integrity;
    if (alreadyPublished) await verify(item, manifest.tag); // Never silently retag an existing version.
    pending.push({ ...item, alreadyPublished });
  }
  const receipt = { sourceSha: context.sha, runId: context.runId, runAttempt: context.runAttempt, tag: manifest.tag, packages: [] };
  const save = () => writeFileSync(join(directory, 'publish-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  save();
  const isolated = mkdtempSync(join(tmpdir(), 'partylayer-npm-publish-'));
  try {
    const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !/^npm_config_/i.test(key)));
    childEnv.NPM_CONFIG_USERCONFIG = join(isolated, 'user.npmrc');
    childEnv.NPM_CONFIG_GLOBALCONFIG = join(isolated, 'global.npmrc');
    for (const name of ['user.npmrc', 'global.npmrc']) writeFileSync(join(isolated, name), '', { flag: 'wx', mode: 0o600 });
    // Snapshot every selected archive before the first write; later downloads cannot replace it.
    for (const item of pending) {
      if (item.alreadyPublished) continue;
      const bytes = archiveBytes(resolve(directory, item.filename));
      assert.equal(integrity(bytes), item.integrity, 'Archive changed after validation.');
      writeFileSync(join(isolated, item.filename), bytes, { flag: 'wx', mode: 0o400 });
    }
    const items = new Map(pending.map(item => [item.name, item]));
    for (const wave of waves) {
      const accepted = [];
      let writeFailed = false;
      for (const name of wave) {
        const item = items.get(name);
        if (item.alreadyPublished) {
          receipt.packages.push({ name: item.name, version: item.version, integrity: item.integrity, status: 'already-published-identical' }); save(); continue;
        }
        const entry = { name: item.name, version: item.version, integrity: item.integrity, status: 'unknown-stop-and-inspect' };
        receipt.packages.push(entry); save(); // Persist intent before a write or runner interruption.
        try {
          // Synchronous, serial and single-attempt. Only the following registry reads overlap.
          // No lifecycle hooks, dependencies, repacking, OTP, stage approval or token fallback.
          execute('npm', ['publish', join(isolated, item.filename), `--registry=${REGISTRY}`, '--access=public',
            `--tag=${manifest.tag}`, '--ignore-scripts', '--provenance', '--json'], isolated, childEnv);
        } catch {
          writeFailed = true;
          break; // Never send another write after an uncertain npm outcome.
        }
        entry.status = 'publish-accepted-awaiting-verification'; save();
        accepted.push({ item, entry });
      }
      // A failed write is not retried or called accepted. Settle only earlier accepted
      // writes, so their bounded, read-only evidence survives in the partial receipt.
      const checked = await Promise.allSettled(accepted.map(async ({ item, entry }) => {
        try {
          await verify(item, manifest.tag);
          entry.status = 'published-verified';
        } catch {
          entry.status = 'publish-accepted-unverified';
          throw new Error('Accepted publication could not be verified.');
        } finally { save(); }
      }));
      if (writeFailed || checked.some(result => result.status === 'rejected')) {
        save();
        throw new Error('Publishing stopped. Inspect the receipt and public registry before retrying; no write was retried, version overwritten, package unpublished or tag changed separately.');
      }
      // Every selected dependency in earlier waves is now publicly verified.
    }
    return receipt;
  } finally { rmSync(isolated, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const context = contextFrom(); const [command, directory] = process.argv.slice(2);
    const api = githubClient(process.env.GH_TOKEN);
    if (command === 'preflight') await publishPreflight(context, api);
    else if (command === 'publish') await publish(context, resolve(directory), api);
    else throw new Error('Use preflight or publish.');
    console.log('Owner-approved publishing checks completed.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
