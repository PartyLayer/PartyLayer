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
  test(`public SDK includes the reviewed default loader for ${wallet.id}`, () => {
    const pkg = wallet.adapter.type;
    if (wallet.id === 'oneswap') {
      // The upstream runtime requires an incompatible old core. Our independently
      // implemented protocol profile ships inside the existing SDK; upstream is
      // pinned only as the blackbox interoperability oracle used by its tests.
      assert.equal(pkg, '@oneswap/wallet-cip0103-adapter');
      assert.equal(sdk.dependencies[pkg], undefined, 'the incompatible vendor runtime must stay out of production');
      assert.match(sdk.devDependencies[pkg] ?? '', /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/, 'keep the interoperability oracle pinned');
      const privateImport = '#partylayer-hosted-wallet-profiles';
      assert.ok(loaders.includes(`import('${privateImport}')`), 'OneSwap needs its reviewed private lazy loader');
      assert.ok(loaders.includes('createOneSwapHostedAdapter({'), 'the loader must construct the hosted transport');
      assert.ok(!loaders.includes(`import('${pkg}')`), 'the production loader cannot execute the incompatible vendor SDK');
      assert.deepEqual(sdk.imports[privateImport], {
        types: './dist/internal/hosted-wallet-profiles.d.ts',
        import: './dist/internal/hosted-wallet-profiles.mjs',
        require: './dist/internal/hosted-wallet-profiles.js',
      });
    } else {
      assert.match(sdk.dependencies[pkg] ?? '', /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/,
        `${pkg} must be reviewed and pinned in packages/sdk/package.json`);
      assert.ok(loaders.includes(`import('${pkg}')`), `${pkg} needs an approved lazy loader`);
    }
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
