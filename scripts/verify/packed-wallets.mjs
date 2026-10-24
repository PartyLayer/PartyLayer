#!/usr/bin/env node
/** Test the actual npm install contract outside the workspace, before publishing. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const staging = await mkdtemp(join(tmpdir(), 'partylayer-packed-wallets-'));
const packs = join(staging, 'packs');
await mkdir(packs);
const run = async (command, args, cwd = root) => {
  try {
    return await exec(command, args, { cwd, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CI: 'true' } });
  } catch (error) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`);
  }
};
console.log(`Packed consumer evidence: ${staging}`);
await run('node', ['scripts/copy-license.mjs']);
const packages = new Map();
for (const base of ['packages', 'packages/adapters']) {
  for (const entry of await readdir(join(root, base))) {
    const dir = join(root, base, entry);
    let pkg;
    try { pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')); } catch { continue; }
    if (pkg.private) continue;
    await run('pnpm', ['pack', '--pack-destination', packs], dir);
    const filename = `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`;
    const bytes = await readFile(join(packs, filename));
    const packed = JSON.parse((await run('tar', ['-xOf', join(packs, filename), 'package/package.json'])).stdout);
    packages.set(pkg.name, { pkg: packed, filename, bytes });
  }
}

// Only our packages are served locally. Third-party requests go straight to npm.
// Thus consumers install using ordinary semver, without workspace/file overrides.
let registry;
const publishedMetadata = new Map();
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
  const tarball = [...packages.values()].find(p => path === `tarballs/${p.filename}`);
  if (tarball) { res.setHeader('content-type', 'application/octet-stream'); res.end(tarball.bytes); return; }
  const item = packages.get(path);
  if (item) {
    const { pkg, bytes, filename } = item;
    res.setHeader('content-type', 'application/json');
    // Retain older published versions: an official SDK may peer-depend on an
    // earlier core version. The clean install must behave like the real registry.
    let metadata = publishedMetadata.get(pkg.name);
    if (!metadata) {
      metadata = fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`,
        { signal: AbortSignal.timeout(30_000), headers: { accept: 'application/vnd.npm.install-v1+json' } })
        .then(async response => response.ok ? response.json() : {});
      publishedMetadata.set(pkg.name, metadata);
    }
    metadata.then(upstream => res.end(JSON.stringify({
      ...upstream, name: pkg.name, 'dist-tags': { ...upstream['dist-tags'], latest: pkg.version },
      versions: { ...upstream.versions, [pkg.version]: { ...pkg, dist: {
        tarball: `${registry}/tarballs/${filename}`,
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      } } },
    }))).catch(error => { res.statusCode = 502; res.end(String(error)); });
    return;
  }
  res.writeHead(307, { location: `https://registry.npmjs.org${req.url}` }); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
registry = `http://127.0.0.1:${server.address().port}`;
const npmFlags = [`--registry=${registry}`, '--no-audit', '--no-fund'];
try {
  const minimal = join(staging, 'single-command');
  await mkdir(minimal);
  await writeFile(join(minimal, 'package.json'), JSON.stringify({
    name: 'packed-wallet-consumer', private: true, type: 'module',
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
  }));
  console.log('Installing the single-command React consumer…');
  await run('npm', ['install', '@partylayer/react', '@tanstack/react-query', ...npmFlags], minimal);
  const beta = await readFile(join(root, 'registry/v1/beta/registry.json'), 'utf8');
  await writeFile(join(minimal, 'registry.json'), beta);
  await writeFile(join(minimal, 'probe.mjs'), `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createPartyLayer } from '@partylayer/sdk';
import { registryEntryToWalletInfo } from '@partylayer/registry-client';
const require = createRequire(import.meta.url);
assert.equal(typeof require('@partylayer/sdk').createPartyLayer, 'function');
assert.equal(typeof require('@partylayer/react').PartyLayerKit, 'function');
assert.equal(typeof require('@partylayer/react').useAuthentication, 'function');
const registry = JSON.parse(readFileSync(new URL('./registry.json', import.meta.url)));
const client = createPartyLayer({ network: 'devnet', channel: 'beta', app: { name: 'Packed consumer' }, discovery: { announce: false } });
client.registryClient.getRegistry = async () => registry;
client.registryClient.getWallets = async () => registry.wallets.map(w => registryEntryToWalletInfo(w, 'beta'));
client.registryClient.getWalletEntry = async id => registry.wallets.find(w => w.id === id);
try {
  const wallets = await client.listWallets();
  for (const entry of registry.wallets.filter(w => w.adapter.transport === 'discovery-adapter')) {
    assert.ok(wallets.some(w => String(w.walletId) === entry.id), entry.id + ' missing from packed defaults');
    assert.ok(client.getAdapter(entry.id), entry.id + ' runtime missing');
  }
  assert.ok(!wallets.some(w => String(w.walletId) === 'send'), 'mainnet-only Send leaked onto Devnet');
} finally { client.destroy(); }
console.log('Single npm command: ESM, CommonJS, SSR initialization and all official defaults passed');
`);
  console.log('Probing ESM, CommonJS, SSR and default wallet discovery…');
  const probe = await run('node', ['probe.mjs'], minimal);
  console.log(probe.stdout.trim());

  // A separate backend declares core directly. A transitive peer may legally
  // hoist an older core at the app root; never test imports an app did not install.
  const backend = join(staging, 'authentication-backend');
  await mkdir(backend);
  await writeFile(join(backend, 'package.json'), JSON.stringify({ name: 'packed-auth-backend', private: true, type: 'module' }));
  await run('npm', ['install', '@partylayer/core', ...npmFlags], backend);
  await writeFile(join(backend, 'probe.mjs'), `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAuthenticationChallenge, formatAuthenticationMessage } from '@partylayer/core/authentication';
import { sumTokenAmounts } from '@partylayer/core/amounts';
const require = createRequire(import.meta.url);
assert.equal(typeof require('@partylayer/core/authentication').verifyAuthenticationProof, 'function');
assert.equal(require('@partylayer/core/amounts').sumTokenAmounts(['0.1', '0.2']), '0.3');
assert.equal(sumTokenAmounts(['9007199254740993.1', '0.2']), '9007199254740993.3');
const challenge = createAuthenticationChallenge({ origin: 'https://app.example', partyId: 'party::packed',
  networkId: 'canton:da-devnet', nonce: 'packed-consumer-nonce-1234567890abcdef' });
assert.ok(formatAuthenticationMessage(challenge).includes('Party: party::packed'));
console.log('Packed server authentication: clean npm, ESM and CommonJS passed');
`);
  console.log((await run('node', ['probe.mjs'], backend)).stdout.trim());

  const cliVersion = packages.get('create-partylayer-app').pkg.version;
  const templates = ['react-vite', 'next-ssr'];
  // npm exec uses the same _npx directory for an identical package spec. Do not
  // let two first-time invocations extract the CLI into that directory at once.
  for (const template of templates) {
    const target = join(staging, template);
    console.log(`Checking packed CLI and clean ${template} consumer…`);
    await run('npm', ['exec', '--yes', `--registry=${registry}`, `--package=create-partylayer-app@${cliVersion}`,
      '--', 'create-partylayer-app', target, '--template', template, '--pm', 'npm', '--no-install', '--no-git'], staging);
  }
  const outcomes = await Promise.allSettled(templates.map(async template => {
    const target = join(staging, template);
    console.log(`Installing ${template} dependencies…`);
    await run('npm', ['install', ...npmFlags], target);
    console.log(`Building ${template}…`);
    const built = await run('npm', ['run', 'build'], target);
    await writeFile(join(staging, `${template}-build.log`), built.stdout + built.stderr);
    console.log(`Packed CLI → ${template}: clean npm installation and production build passed`);
  }));
  for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason;
  const result = JSON.stringify({ passed: true,
    sdk: packages.get('@partylayer/sdk').pkg.version,
    react: packages.get('@partylayer/react').pkg.version, cli: cliVersion,
    checks: ['single-command-install', 'esm', 'commonjs', 'ssr', 'official-defaults', 'authentication-backend', 'react-vite', 'next-ssr'],
  }, null, 2);
  await writeFile(join(staging, 'result.json'), result);
  const evidence = join(root, 'artifacts/packed-wallets');
  await mkdir(evidence, { recursive: true });
  await writeFile(join(evidence, 'result.json'), result);
  for (const template of ['react-vite', 'next-ssr']) {
    await copyFile(join(staging, `${template}-build.log`), join(evidence, `${template}-build.log`));
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
