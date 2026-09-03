#!/usr/bin/env node
/**
 * Copy the root `registry/` into `apps/demo/public/registry/` so the demo can
 * serve the branch's registry (JSON *and* wallet marks) as static assets:
 *   - `/registry/v1/<channel>/registry.json`
 *   - `/registry/wallets/<file>`
 *
 * Why: the SDK's default registry URL points at the production CDN
 * (`registry.partylayer.xyz`), which lags behind whatever was last deployed. The
 * demo's job is to show the SDK's CURRENT branch state, so the demo serves the
 * branch's own registry from its static assets rather than reading the CDN.
 * The wallet marks are copied alongside it and served at `/registry/wallets/`,
 * available to anything that wants them.
 *
 * The copy is BYTE-FOR-BYTE identical to the source. It used to have its `icon`
 * URLs rewritten from the CDN host to a demo-local `/registry/wallets/` path,
 * so a contributor's branch-local mark would render. That rewrite is gone.
 *
 * Why: the registry signature covers the exact UTF-8 bytes of registry.json.
 * A build step that rewrites those bytes produces a file whose signature can
 * never verify, and the failure surfaces as "signature verification failed",
 * which reads as tampering rather than as a local build artefact. It would have
 * been blamed on signing the first time anyone hit it. This is a defect
 * independently of signing: a copy that claims to be the registry should be the
 * registry.
 *
 * Icons therefore resolve to the absolute URLs the registry entry declares,
 * which is what a real SDK consumer sees. To show a branch-local mark, put a
 * relative icon URL in the registry entry itself, in the same PR that adds the
 * image. That keeps one source of truth and needs no build-time mutation.
 *
 * Run automatically by the `predev` and `prebuild` lifecycle hooks (see
 * apps/demo/package.json). The destination directory is gitignored; the root
 * `registry/` directory remains the single source of truth.
 */

import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = join(__dirname, '..', '..', '..', 'registry');
const DEST_ROOT = join(__dirname, '..', 'public', 'registry');

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

/**
 * Copy each channel's registry.json and its signature, unmodified.
 *
 * copyFile rather than read/transform/write on purpose: it is the only form
 * that cannot accidentally reintroduce a byte-level rewrite, and the signature
 * is over exact bytes.
 */
async function copyRegistryJson() {
  const channels = await readdir(join(SOURCE_ROOT, 'v1'));
  for (const channel of channels) {
    const srcDir = join(SOURCE_ROOT, 'v1', channel);
    const destDir = join(DEST_ROOT, 'v1', channel);
    await mkdir(destDir, { recursive: true });
    const files = await readdir(srcDir);
    for (const file of files) {
      if (!file.endsWith('.json') && !file.endsWith('.sig')) continue;
      const src = join(srcDir, file);
      const dest = join(destDir, file);
      await copyFile(src, dest);
      console.log(`copied ${src} → ${dest}`);
    }
  }
}

Promise.all([copyWalletMarks(), copyRegistryJson()]).catch((err) => {
  console.error('Failed to copy registry:', err);
  process.exit(1);
});
