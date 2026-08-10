#!/usr/bin/env node
/**
 * Regression gate: packages/adapters is closed to new wallets.
 *
 * A wallet integrates with PartyLayer through one of two generic paths and ships no
 * PartyLayer-specific code: Path A announces over `canton:announceProvider` and is
 * driven with no adapter object, and Path B ships the wallet's own package exporting
 * an object satisfying the official `ProviderAdapter` shape. The packages under
 * packages/adapters predate those paths and are kept for compatibility with dApps
 * already depending on them.
 *
 * The risk this guards is a reading problem, not a code problem. A contributor who
 * opens the repository before the docs site finds a directory of wallet-named packages
 * and could reasonably infer that adding another one is the expected route. Going that
 * way means building something the project does not need, and finding out late.
 * Documentation alone does not prevent it, because the directory is more visible than
 * the guide. So the wrong path fails here, in seconds, with the right path printed.
 *
 * The allowlist below is FROZEN. It is the set of packages that existed when the
 * directory was closed, and it is not a list to extend as wallets are added.
 *
 * The escape hatch is deliberate. If a future maintainer genuinely needs a new package
 * here, adding its directory to the allowlist is the conscious act that unblocks it, and
 * the pull request must state why the generic paths did not fit.
 *
 * Run via `pnpm gate:adapters-closed`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const adaptersDir = join(repoRoot, 'packages', 'adapters');

const GUIDE = 'https://partylayer.xyz/docs/generic-bridge';

/**
 * The PartyLayer-specific adapter packages that predate the generic bridge. FROZEN: see
 * the escape hatch in the header before touching this.
 */
const LEGACY_ADAPTERS = [
  'bron',
  'cantor8',
  'console',
  'loop',
  'nightly',
  'send',
  'walletconnect',
];

if (!existsSync(adaptersDir)) {
  console.error(`X packages/adapters not found at ${adaptersDir}.`);
  process.exit(1);
}

const present = readdirSync(adaptersDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const unexpected = present.filter((name) => !LEGACY_ADAPTERS.includes(name));
const missing = LEGACY_ADAPTERS.filter((name) => !present.includes(name));

// A retired package is not a failure, but a stale allowlist entry is worth saying out
// loud so the list does not quietly drift from the directory it describes.
for (const name of missing) {
  console.log(`NOTE allowlisted "${name}" is no longer present; the allowlist entry is stale.`);
}

if (unexpected.length > 0) {
  for (const name of unexpected) {
    console.error(
      `\nX packages/adapters/${name} is a new adapter package, and this directory is closed.\n\n` +
        `A new wallet does not need a PartyLayer-specific package. Integrate through one of\n` +
        `the two generic paths instead, shipping no PartyLayer-specific code:\n\n` +
        `  If the wallet lives in the page, Path A (announce over canton:announceProvider).\n` +
        `  If it is a remote service or opens a popup, Path B (ship an official ProviderAdapter).\n\n` +
        `A registry entry is optional and is metadata only, no code.\n\n` +
        `  Guide:     ${GUIDE}\n` +
        `  In repo:   packages/adapters/README.md\n` +
        `  Onboarding: docs/registry-onboarding.md\n\n` +
        `If a maintainer has concluded that neither path fits, add "${name}" to\n` +
        `LEGACY_ADAPTERS in scripts/gate/adapters-closed.mjs and say why in the pull request.\n` +
        `That edit is the conscious act that unblocks this check.`,
    );
  }
  console.error('\nX Adapters-closed check FAILED.');
  process.exit(1);
}

console.log(
  `OK Adapters-closed check PASSED. ${present.length} legacy adapter package(s), no new ones: ${present.join(', ')}.`,
);
