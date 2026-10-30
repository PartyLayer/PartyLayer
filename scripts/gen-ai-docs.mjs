#!/usr/bin/env node
/** Deterministic public AI reference, sourced from the same guides developers read. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://partylayer.xyz';
const REPOSITORY = 'https://github.com/PartyLayer/PartyLayer';
export const OUTPUTS = ['apps/demo/public/llms.txt', 'apps/demo/public/llms-full.txt'];

const GUIDES = [
  ['Introduction', '/docs'],
  ['Installation and new-app CLI', '/docs/installation'],
  ['React and Next.js quick start', '/docs/quick-start'],
  ['Upgrade an existing application', '/docs/migration'],
  ['AI-assisted integration and optional skill', '/docs/ai-integration'],
  ['Coming from RainbowKit', '/docs/rainbowkit-for-canton'],
  ['PartyLayerKit configuration', '/docs/partylayer-kit'],
  ['ConnectButton', '/docs/connect-button'],
  ['Wallet modal', '/docs/wallet-modal'],
  ['Theming', '/docs/theming'],
  ['React hooks and optional data hooks', '/docs/hooks'],
  ['Framework-independent TypeScript SDK', '/docs/vanilla-js'],
  ['Wallet networks and configuration', '/docs/wallets'],
  ['CIP-0103 provider', '/docs/cip-0103'],
  ['Generic provider bridge', '/docs/generic-bridge'],
  ['Server-verified authentication', '/docs/authentication'],
  ['Transaction lifecycle and optional reload recovery', '/docs/transaction-lifecycle'],
  ['Wallet holdings and authorized reads', '/docs/wallet-balances'],
  ['Token transfers and command requirements', '/docs/token-transfers'],
  ['Swap integration and settlement', '/docs/swaps'],
  ['Production checklist', '/docs/production-checklist'],
  ['Integration support', '/docs/integration-support'],
];

/** Preserve code verbatim; make relative prose links work outside their source file. */
export function absoluteLinks(markdown, source, root = ROOT) {
  let fenced = false;
  return markdown.split('\n').map(line => {
    if (/^```/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    return line.replace(/\]\((\.{1,2}\/[^)]+)\)/g, (match, target) => {
      const [path, anchor] = target.split('#');
      const relative = posix.normalize(posix.join(posix.dirname(source), path));
      if (relative.startsWith('../') || !existsSync(join(root, relative))) {
        throw new Error(`Broken source link in ${source}: ${target}`);
      }
      return `](${REPOSITORY}/blob/main/${relative}${anchor ? `#${anchor}` : ''})`;
    });
  }).join('\n');
}

export function generateAiDocs(root = ROOT) {
  const read = file => readFileSync(join(root, file), 'utf8');
  for (const [, route] of GUIDES) {
    if (!existsSync(join(root, 'apps/demo/src/app', route, 'page.tsx'))) {
      throw new Error(`AI documentation links to a missing route: ${route}`);
    }
  }
  const stable = JSON.parse(read('registry/v1/stable/registry.json'));
  const beta = JSON.parse(read('registry/v1/beta/registry.json'));
  const stableIds = new Set(stable.wallets.map(wallet => wallet.id));
  if (!stable.wallets.every(wallet => beta.wallets.some(entry => entry.id === wallet.id))) {
    throw new Error('Beta registry must include every stable wallet');
  }
  // A stable entry's channel and networks come from stable, never a beta override.
  const wallets = [...stable.wallets, ...beta.wallets.filter(wallet => !stableIds.has(wallet.id))];
  const table = [
    '| Wallet | Catalog networks | Channel | Application setup |',
    '| --- | --- | --- | --- |',
    ...wallets.map(wallet => `| ${wallet.name} | ${wallet.supportedNetworks.join(', ')} | ${stableIds.has(wallet.id) ? 'stable' : 'beta'} | ${wallet.id === 'walletconnect' ? 'Your WalletConnect project ID' : wallet.id === 'bron' ? 'Your OAuth/API configuration' : wallet.adapter.requiresConfig ? 'Application configuration required' : 'Included runtime'} |`),
  ].join('\n');
  const versions = ['react', 'sdk', 'create-partylayer-app'].map(name => {
    const manifest = JSON.parse(read(`packages/${name}/package.json`));
    return `- ${manifest.name}: ${manifest.version}`;
  }).join('\n');
  const header = '# PartyLayer\n\n> CIP-0103 compliant Canton Network wallet connection kit. One React installation includes the SDK, supported wallet runtimes and a branded Connect Wallet UI.\n\n';
  const links = GUIDES.map(([title, route]) => `- [${title}](${ORIGIN}${route})`).join('\n');
  const resources = `- [Wallet directory](${ORIGIN}/wallets)\n- [Interactive Devnet demo](${ORIGIN}/kit-demo)\n- [Integration skill](${REPOSITORY}/blob/main/skills/partylayer-integration/SKILL.md)\n- [GitHub](${REPOSITORY})\n- [npm React kit](https://www.npmjs.com/package/@partylayer/react)\n- [Full text reference](${ORIGIN}/llms-full.txt)`;
  const index = `${header}Start with the quick start for the complete installation and provider/button examples. Wallet support depends on the selected network, channel and application configuration.\n\n## Documentation\n\n${links}\n\n## Resources\n\n${resources}\n`;
  const guide = (file, heading) => {
    const text = absoluteLinks(read(file), file, root).replace(/^# [^\n]+\n/, '');
    return `## ${heading}\n\nSource: [${file}](${REPOSITORY}/blob/main/${file}).\n${text.trim()}\n`;
  };
  const full = `${header}Generated by scripts/gen-ai-docs.mjs from maintained guides, package manifests and both registry channels. Source versions below describe this deployed reference; check npm for current dist-tags.\n\n## Reference versions\n\n${versions}\n\n## Wallet catalog and acceptance scope\n\n${table}\n\nCatalog membership and capability declarations are not completed live-wallet acceptance. Send is Mainnet-only in this catalog. Vala requires Devnet and the beta channel. Hosted-wallet login, approval and funding belong to the user and wallet provider. A connection or message signature does not establish a successful transfer or swap. Read the [wallet matrix](${REPOSITORY}/blob/main/docs/wallet-cip0103-matrix.md) and [release evidence](${REPOSITORY}/blob/main/docs/releasing.md#default-wallet-release-validation).\n\n${guide('docs/quick-start.md', 'React integration guide')}\n${guide('packages/sdk/README.md', 'Framework-independent SDK guide')}\n## Documentation index\n\n${links}\n\n## Resources\n\n${resources}\n`;
  return new Map([[OUTPUTS[0], index], [OUTPUTS[1], full]]);
}

export function staleOutputs(root = ROOT) {
  return [...generateAiDocs(root)].filter(([file, content]) => !existsSync(join(root, file)) || readFileSync(join(root, file), 'utf8') !== content).map(([file]) => file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--write')) {
    for (const [file, content] of generateAiDocs()) writeFileSync(join(ROOT, file), content);
    console.log('Updated llms.txt and llms-full.txt from current integration guides and registry channels.');
  } else {
    const stale = staleOutputs();
    if (stale.length) {
      console.error(`Stale AI reference: ${stale.join(', ')}. Run pnpm gen:ai-docs and commit the generated files.`);
      process.exitCode = 1;
    } else console.log('PASS: public AI references match the maintained guides, manifests and wallet catalogs.');
  }
}
