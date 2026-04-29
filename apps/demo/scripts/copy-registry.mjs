#!/usr/bin/env node
/**
 * Copy the root `registry/v1/{stable,beta}/registry.json` files into
 * `apps/demo/public/registry/` so the demo can serve the branch's
 * registry as a static asset at `/registry/v1/<channel>/registry.json`.
 *
 * Why: the SDK's default registry URL points at the production CDN
 * (`registry.partylayer.xyz`), which lags behind whatever was last
 * deployed. The demo's job is to show the SDK's CURRENT branch state.
 * Sourcing the registry from the demo's own static assets makes
 * localhost:3000 and the deployed demo (partylayer.xyz) byte-identical
 * to the branch's `registry/` directory.
 *
 * Run automatically by the `predev` and `prebuild` lifecycle hooks
 * (see apps/demo/package.json). The destination directory is gitignored;
 * the root `registry/` directory remains the single source of truth.
 */

import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = join(__dirname, '..', '..', '..', 'registry');
const DEST_ROOT = join(__dirname, '..', 'public', 'registry');

async function copyRegistryTree() {
  const channels = await readdir(join(SOURCE_ROOT, 'v1'));
  for (const channel of channels) {
    const srcDir = join(SOURCE_ROOT, 'v1', channel);
    const destDir = join(DEST_ROOT, 'v1', channel);
    await mkdir(destDir, { recursive: true });
    const files = await readdir(srcDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const src = join(srcDir, file);
      const dest = join(destDir, file);
      await copyFile(src, dest);
      console.log(`copied ${src} → ${dest}`);
    }
  }
}

copyRegistryTree().catch((err) => {
  console.error('Failed to copy registry:', err);
  process.exit(1);
});
