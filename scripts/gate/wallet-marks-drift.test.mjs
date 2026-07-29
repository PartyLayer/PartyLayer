/**
 * Wallet-marks drift guard (gate:wallet-marks).
 *
 * The registry is the SINGLE source of truth for every wallet's logo: the marks
 * live in `registry/wallets/`, and each `registry/v1/<channel>/registry.json`
 * entry points its `icon` at one of them. Every consumer (the SDK modal, the
 * demos, the landing) renders that registry icon.
 *
 * This guard exists because that truth drifted once: the landing kept its OWN
 * hand-maintained `WALLET_LOGOS` map of wallet id → `/wallets/<file>` that pointed
 * at local copies, while the registry served different (placeholder) marks. The
 * landing showed one logo and every other consumer showed another. This test is
 * the thing that stops that recurring. It asserts three invariants:
 *
 *  1. Every `icon` URL in either channel's registry.json resolves to a file that
 *     exists in `registry/wallets/` (no dangling reference).
 *  2. Every image in `registry/wallets/` is referenced by at least one registry
 *     entry (no orphan / leftover placeholder), and is listed in NOTICE.md.
 *  3. The demo source carries NO hand-maintained logo map: no `/wallets/<file>`
 *     image literal appears in the landing or kit-demo. The demo must render the
 *     registry icon (served locally from `/registry/wallets/` by
 *     scripts/copy-registry.mjs), never a second local map that can diverge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WALLETS_DIR = join(ROOT, 'registry', 'wallets');
const CHANNELS = ['stable', 'beta'];
const IMAGE_RE = /\.(png|jpe?g|svg)$/i;

function registryFor(channel) {
  return JSON.parse(readFileSync(join(ROOT, 'registry', 'v1', channel, 'registry.json'), 'utf8'));
}
/** The set of asset filenames referenced by icon URLs across both channels. */
function referencedFiles() {
  const refs = new Set();
  for (const channel of CHANNELS) {
    for (const w of registryFor(channel).wallets) {
      if (typeof w.icon === 'string' && w.icon) refs.add(basename(w.icon));
    }
  }
  return refs;
}
const imageFiles = () => readdirSync(WALLETS_DIR).filter((f) => IMAGE_RE.test(f));

test('(1) every registry icon resolves to a file in registry/wallets/', () => {
  for (const channel of CHANNELS) {
    for (const w of registryFor(channel).wallets) {
      assert.ok(typeof w.icon === 'string' && w.icon.length > 0, `[${channel}] "${w.id}" has no icon`);
      const file = basename(w.icon);
      assert.ok(
        existsSync(join(WALLETS_DIR, file)),
        `[${channel}] "${w.id}" icon → ${file}, but registry/wallets/${file} does not exist`,
      );
    }
  }
});

test('(2) every mark in registry/wallets/ is referenced + noticed (no orphan / placeholder)', () => {
  const refs = referencedFiles();
  const notice = readFileSync(join(WALLETS_DIR, 'NOTICE.md'), 'utf8');
  for (const file of imageFiles()) {
    assert.ok(
      refs.has(file),
      `registry/wallets/${file} is not referenced by any registry entry; remove it or point an entry at it (leftover placeholder?)`,
    );
    assert.ok(notice.includes(file), `registry/wallets/${file} is not listed in NOTICE.md`);
  }
});

test('(3) the demo has no hand-maintained wallet-logo map', () => {
  const files = [
    join(ROOT, 'apps', 'demo', 'src', 'app', 'page.tsx'),
    join(ROOT, 'apps', 'demo', 'src', 'app', 'kit-demo', 'page.tsx'),
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    // Ignore the legitimate `/registry/wallets/<file>` path (icons served locally
    // from the copied registry); flag only a bare `/wallets/<file>` image literal,
    // the old divergent map. Doc links like `/docs/wallets/send` have no image
    // extension, so they never match.
    const src = readFileSync(file, 'utf8').split('/registry/wallets/').join('/registry-wallets-ok/');
    const hits = [...src.matchAll(/\/wallets\/[A-Za-z0-9._-]+\.(?:png|jpe?g|svg)/g)].map((m) => m[0]);
    assert.equal(
      hits.length,
      0,
      `${file.replace(ROOT + '/', '')} references a local wallet-logo path (${[...new Set(hits)].join(', ')}). ` +
        `Render the registry icon (w.icon) instead; the registry is the single source of truth for marks.`,
    );
  }
});
