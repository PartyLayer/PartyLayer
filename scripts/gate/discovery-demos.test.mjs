/** Every approved discovery wallet ships in the public SDK, used by all demos. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const registry = JSON.parse(read('registry/v1/beta/registry.json'));
const sdk = JSON.parse(read('packages/sdk/package.json'));
const loaders = read('packages/sdk/src/default-wallets.ts');

for (const wallet of registry.wallets.filter(w => w.adapter.transport === 'discovery-adapter')) {
  test(`public SDK includes the reviewed, pinned official SDK for ${wallet.id}`, () => {
    const pkg = wallet.adapter.type;
    assert.match(sdk.dependencies[pkg] ?? '', /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/,
      `${pkg} must be reviewed and pinned in packages/sdk/package.json`);
    assert.ok(loaders.includes(`import('${pkg}')`), `${pkg} needs an approved lazy loader`);
    assert.match(loaders, new RegExp(`\\b${wallet.id}:\\s*async`));
  });
}

for (const [app, source] of [
  ['demo', 'src/app/content.tsx'],
  ['demo', 'src/app/kit-demo/page.tsx'],
  ['tokenization', 'src/App.tsx'],
  ['dvp', 'src/App.tsx'],
]) {
  test(`${app}/${source} uses the same public default catalog as npm consumers`, () => {
    const content = read(`apps/${app}/${source}`);
    assert.ok(content.includes('PartyLayerKit'));
    assert.doesNotMatch(content, /\badapters\s*=/, 'adapters replaces defaults; use additionalAdapters to extend');
    const deps = JSON.parse(read(`apps/${app}/package.json`)).dependencies;
    assert.ok(deps['@partylayer/react']);
    assert.ok(!deps['@partylayer/demo-adapters']);
  });
}
