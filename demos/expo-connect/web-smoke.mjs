#!/usr/bin/env node
/**
 * Web smoke for @partylayer/react-native: the check that would have caught the
 * bundler-invisible module loading before it shipped. It exports the demo for web, serves
 * it, and drives it with Playwright: the app boots, the wallet list opens, the rows and
 * their logos render, and there is NO page error. This is a REQUIRED pre-publish step for
 * the react-native package (see docs/releasing.md).
 *
 * Run from demos/expo-connect: `pnpm run web-smoke`
 *
 * Requires Playwright with a Chromium build (resolved from the repo root) and that the
 * demo is installed (`pnpm run prepare-local && pnpm install --ignore-workspace`).
 */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const require = createRequire(import.meta.url);

// Playwright is a repo dev tool, resolved by walking up to the repo root.
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not resolvable. Run the smoke from inside the repo, which provides it.');
  process.exit(2);
}

const PORT = 8099;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

console.log('Exporting the demo for web...');
execSync('npx expo export --platform web', { cwd: here, stdio: 'inherit' });
if (!existsSync(join(dist, 'index.html'))) {
  console.error('Export did not produce dist/index.html.');
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  let file = join(dist, url === '/' ? 'index.html' : url);
  if (!existsSync(file)) file = join(dist, 'index.html'); // SPA fallback
  try {
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});

const fail = (msg) => {
  console.error('SMOKE FAILED: ' + msg);
  server.close();
  process.exit(1);
};

// A missing CDN icon returns HTML, which react-native-svg's parser rejects with a noisy
// console.error ("Expected closing tag", "valid SVG"). That is the broken-asset issue, not
// a module-loading regression, so it is tolerated (logged, not failed).
const isBrokenIconNoise = (text) => /valid SVG|closing tag|match opening tag/i.test(text);

server.listen(PORT, async () => {
  const pageErrors = []; // uncaught exceptions: a module-loading regression crashes here
  const otherConsole = []; // console.errors that are not broken-icon noise
  const iconNoise = [];
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    (isBrokenIconNoise(m.text()) ? iconNoise : otherConsole).push(m.text());
  });

  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="connect-button"]', { timeout: 20000 });
    await page.waitForTimeout(2500); // registry fetch

    await page.click('[data-testid="connect-button"]');
    await page.waitForSelector('[data-testid^="wallet-row-"]', { timeout: 10000 });
    await page.waitForTimeout(3000); // SVG fetches + fallbacks settle

    const rows = await page.$$('[data-testid^="wallet-row-"]');
    if (rows.length === 0) fail('no wallet rows rendered');

    // Per row: svg (react-native-svg loaded), img (Image), fallback (neutral glyph), or
    // none. This is the module-loading guard: a reversion to a bundler-invisible require
    // makes react-native-svg fail to load, which crashes the modal (a page error) and
    // drops the svg count to zero.
    const perWallet = await page.evaluate(() => {
      const out = {};
      for (const row of document.querySelectorAll('[data-testid^="wallet-row-"]')) {
        const id = row.getAttribute('data-testid').replace('wallet-row-', '');
        const fallback = row.querySelector(`[data-testid="icon-${id}-fallback"]`);
        const svg = row.querySelector('svg');
        const img = row.querySelector('img');
        out[id] = fallback ? 'fallback' : svg ? 'svg' : img ? 'img' : 'none';
      }
      return out;
    });
    const renderers = Object.values(perWallet);
    console.log('Per wallet logo renderer:', JSON.stringify(perWallet));

    // The core assertions that regress if module loading breaks.
    if (pageErrors.length) fail('uncaught page errors (module loading likely broken):\n' + pageErrors.join('\n'));
    if (otherConsole.length) fail('unexpected console errors:\n' + otherConsole.join('\n'));
    if (!renderers.includes('svg')) fail('no wallet rendered an SVG logo (react-native-svg did not load)');
    if (!renderers.includes('img')) fail('no wallet rendered an Image logo');

    // WalletIcon now validates that a fetched svg url is really SVG before rendering, so a
    // wallet whose CDN icon is missing or is not really an image falls back to the neutral
    // glyph instead of rendering nothing. Every wallet must render something.
    const none = Object.entries(perWallet).filter(([, r]) => r === 'none').map(([id]) => id);
    if (none.length) fail('wallet(s) rendered no logo, the neutral fallback should have triggered: ' + none.join(', '));

    // walletconnect is the row that exercised the validation path, so keep it named: it
    // must render its real logo or the neutral glyph, never nothing and never a letter.
    if (perWallet.walletconnect && perWallet.walletconnect !== 'fallback' && perWallet.walletconnect !== 'img' && perWallet.walletconnect !== 'svg') {
      fail(`walletconnect rendered "${perWallet.walletconnect}", expected its real logo or the neutral glyph`);
    }
    if (perWallet.walletconnect) console.log(`walletconnect: rendered "${perWallet.walletconnect}".`);

    console.log('SMOKE OK: wallet list opened, every wallet rendered a logo or the neutral fallback, no uncaught page errors.');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    if (errors.length) console.error('page errors:\n' + errors.join('\n'));
    await browser.close();
    fail('exception during smoke');
  }
});
