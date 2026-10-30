/** Publish exact reviewed files only from the owner's protected GitHub job. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { POLICY, REGISTRY, archiveBytes, contextFrom, githubClient, preflight, verifyManifest,
  selectPackages, packageOrder, sourcePackages, registryState } from './owner-approved.mjs';

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
  timeoutMs = 300_000, pollMs = 5_000,
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
  assert.deepEqual(manifest.packages.map(item => item.name), packageOrder(selectPackages(env.RELEASE_PACKAGES ?? ''), sourcePackages(root), root), 'Artifact selection differs from owner dispatch.');
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
    for (const item of pending) {
      if (item.alreadyPublished) {
        receipt.packages.push({ name: item.name, version: item.version, integrity: item.integrity, status: 'already-published-identical' }); save(); continue;
      }
      const entry = { name: item.name, version: item.version, integrity: item.integrity, status: 'unknown-stop-and-inspect' };
      receipt.packages.push(entry); save(); // Persist intent before a write or runner interruption.
      try {
        // No lifecycle hooks, dependencies, repacking, OTP, stage approval or token fallback.
        execute('npm', ['publish', join(isolated, item.filename), `--registry=${REGISTRY}`, '--access=public',
          `--tag=${manifest.tag}`, '--ignore-scripts', '--provenance', '--json'], isolated, childEnv);
        await verify(item, manifest.tag);
        entry.status = 'published-verified'; save();
      } catch {
        save();
        throw new Error('Publishing stopped. Inspect the receipt and public registry before retrying; no write was retried, version overwritten, package unpublished or tag changed separately.');
      }
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
