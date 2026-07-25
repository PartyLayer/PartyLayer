#!/usr/bin/env node
/**
 * Standalone runtime check: prove the demo loaded the LOCAL core (with the phase A
 * deep link additions), not the npm 0.11.0 copy that lacks them. Run after install:
 *
 *   node verify-core.mjs
 *
 * The app shows the same result on screen; this is the headless equivalent.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const core = require('@partylayer/core');
const hasFactory = typeof core.createBrowserDeepLinkPlatform === 'function';
// A working platform proves the phase A additions loaded, not just a matching symbol.
const platformOk = hasFactory && (() => {
  const p = core.createBrowserDeepLinkPlatform();
  return p && typeof p.openUrl === 'function' && typeof p.subscribe === 'function';
})();

console.log('createBrowserDeepLinkPlatform present:', hasFactory);
console.log('deep link platform usable:', platformOk);

if (!hasFactory) {
  console.error(
    '\nFAIL: the loaded core does not contain createBrowserDeepLinkPlatform. The demo is ' +
      'resolving the npm registry copy instead of the local build. Run prepare-local.mjs ' +
      'and reinstall so the vendor tarballs are used.',
  );
  process.exit(1);
}
console.log('\nOK: the demo is running the local core build.');
