#!/usr/bin/env node
/**
 * Copy the root `registry/` into `apps/demo/public/registry/` so the demo can
 * serve the branch's registry (JSON *and* wallet marks) as static assets:
 *   - `/registry/v1/<channel>/registry.json`
 *   - `/registry/wallets/<file>`
 *
 * Why: the SDK's default registry URL points at the production CDN
 * (`registry.partylayer.xyz`), which lags behind whatever was last deployed. The
 * demo's job is to show the SDK's CURRENT branch state. Sourcing BOTH the
 * registry JSON and the icons from the demo's own static assets makes
 * localhost:3000 and the deployed demo byte-identical to the branch's
 * `registry/` directory, with no hand-maintained per-wallet logo map, and no
 * dependency on a CDN redeploy to show the branch's marks.
 *
 * To keep the icons local, each copied registry.json has its `icon` URLs
 * rewritten from the absolute CDN host to the demo-local `/registry/wallets/`
 * path. The root `registry/` files are untouched (they keep the absolute CDN
 * URLs real SDK consumers need); only the demo's copy is localized.
 *
 * Run automatically by the `predev` and `prebuild` lifecycle hooks (see
 * apps/demo/package.json). The destination directory is gitignored; the root
 * `registry/` directory remains the single source of truth.
 */

import { mkdir, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = join(__dirname, '..', '..', '..', 'registry');
const DEST_ROOT = join(__dirname, '..', 'public', 'registry');

// The absolute CDN base every root registry.json uses for its icons. Rewriting
// this to a site-relative path makes the demo render the LOCAL (branch) marks.
const CDN_WALLETS = 'https://registry.partylayer.xyz/wallets/';
const LOCAL_WALLETS = '/registry/wallets/';

/** Copy every wallet mark (registry/wallets/*) into the demo's static assets. */
async function copyWalletMarks() {
  const srcDir = join(SOURCE_ROOT, 'wallets');
  const destDir = join(DEST_ROOT, 'wallets');
  await mkdir(destDir, { recursive: true });
  const files = await readdir(srcDir);
  for (const file of files) {
    // Skip the human-facing notice; only the image marks are served.
    if (file.endsWith('.md')) continue;
    const src = join(srcDir, file);
    const dest = join(destDir, file);
    await copyFile(src, dest);
    console.log(`copied ${src} → ${dest}`);
  }
}

/** Copy each channel's registry.json, rewriting icon URLs to the local path. */
async function copyRegistryJson() {
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
      const raw = await readFile(src, 'utf8');
      // String-level rewrite (not parse/stringify) to preserve formatting; the
      // CDN base is unique to icon URLs, so this only touches those fields.
      const localized = raw.split(CDN_WALLETS).join(LOCAL_WALLETS);
      await writeFile(dest, localized);
      console.log(`copied ${src} → ${dest} (icons localized)`);
    }
  }
}

Promise.all([copyWalletMarks(), copyRegistryJson()]).catch((err) => {
  console.error('Failed to copy registry:', err);
  process.exit(1);
});
