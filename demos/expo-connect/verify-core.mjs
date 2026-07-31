#!/usr/bin/env node
/**
 * Standalone runtime check: prove the demo resolved the LOCAL vendored builds of the
 * PartyLayer packages, not registry copies. Run after install:
 *
 *   node verify-core.mjs
 *
 * Provenance is read from the resolved module path, which names the source of the
 * install: pnpm places a `file:` dependency under a directory carrying the tarball
 * name, so a vendored install resolves through `vendor/<name>.tgz`. This checks the
 * thing the demo actually depends on. Checking for an exported symbol would not, since
 * the published packages export the same names.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const PACKAGES = ['@partylayer/core', '@partylayer/react-native'];

let ok = true;
for (const name of PACKAGES) {
  let resolved;
  try {
    resolved = require.resolve(name);
  } catch (e) {
    console.log(`${name}: NOT RESOLVED (${e instanceof Error ? e.message : String(e)})`);
    ok = false;
    continue;
  }
  const vendored = resolved.includes('file+vendor') || resolved.includes(`${'vendor'}/`);
  console.log(`${name}: ${vendored ? 'local vendored build' : 'registry copy'}`);
  console.log(`  ${resolved}`);
  if (!vendored) ok = false;
}

if (!ok) {
  console.error(
    '\nFAIL: at least one package did not resolve to a vendor tarball. Run ' +
      '`pnpm run prepare-local` and reinstall so the vendored builds are used.',
  );
  process.exit(1);
}
console.log('\nOK: the demo is running the local vendored builds.');
