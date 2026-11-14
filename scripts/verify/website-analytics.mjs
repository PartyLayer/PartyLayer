/** Production-bundle smoke. All apparent public-host traffic is fulfilled from a local server. */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3197');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) && base.protocol === 'http:' && !base.username && !base.password,
  'Use an explicitly local production server, never a live website.');
const expectedToken = '95c384a210c948ea846e65c466fe539f'; // Public site id, not an API credential.
const hosts = new Set(['partylayer.xyz', 'www.partylayer.xyz', 'partylayer.xyz.example.com']);
const browser = await chromium.launch();
try {
  const results = [];
  for (const hostname of ['partylayer.xyz', 'www.partylayer.xyz', 'partylayer.xyz.example.com', base.hostname]) {
    const context = await browser.newContext();
    let beaconLoads = 0;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://static.cloudflareinsights.com') {
        beaconLoads++;
        // The real beacon is NEVER downloaded/executed. No verification traffic
        // or artificial visits reach Cloudflare's production metrics endpoint.
        await route.fulfill({ contentType: 'text/javascript', body: 'window.__PARTYLAYER_BEACON_SMOKE__ = true; window.__PARTYLAYER_BEACON_EXECUTIONS__ = (window.__PARTYLAYER_BEACON_EXECUTIONS__ || 0) + 1;' });
      } else if (hosts.has(url.hostname)) {
        const local = new URL(url.pathname + url.search, base);
        await route.fulfill({ response: await route.fetch({ url: local.href }) });
      } else if (url.origin === base.origin) await route.continue();
      else await route.abort();
    });
    try {
      const page = await context.newPage();
      const origin = hostname === base.hostname ? base.origin : `https://${hostname}`;
      await page.goto(`${origin}/docs`, { waitUntil: 'networkidle' });
      const enabled = hostname === 'partylayer.xyz' || hostname === 'www.partylayer.xyz';
      if (enabled) {
        await page.waitForFunction(() => window.__PARTYLAYER_BEACON_SMOKE__ === true);
        const script = page.locator('#partylayer-website-analytics');
        assert.equal(await script.count(), 1);
        assert.deepEqual(JSON.parse(await script.getAttribute('data-cf-beacon')), { token: expectedToken, spa: true });
        const initialLoads = beaconLoads;
        const marker = await page.evaluate(() => { window.__PARTYLAYER_DOCUMENT_MARKER__ = crypto.randomUUID(); return window.__PARTYLAYER_DOCUMENT_MARKER__; });
        await page.locator('a[href="/docs/installation"]').first().click();
        await page.waitForURL('**/docs/installation');
        assert.equal(await page.locator('#partylayer-website-analytics').count(), 1);
        assert.equal(await page.evaluate(value => window.__PARTYLAYER_DOCUMENT_MARKER__ === value, marker), true, 'Verify an actual client navigation, not a document reload');
        assert.equal(await page.evaluate(() => window.__PARTYLAYER_BEACON_EXECUTIONS__), 1, 'Execute exactly one beacon per document');
        assert.equal(beaconLoads, 1, `Client navigation must not inject another beacon (initial=${initialLoads}, executions=${await page.evaluate(() => window.__PARTYLAYER_BEACON_EXECUTIONS__)}, sameDocument=${await page.evaluate(value => window.__PARTYLAYER_DOCUMENT_MARKER__ === value, marker)})`);
      } else {
        assert.equal(await page.locator('#partylayer-website-analytics').count(), 0);
        assert.equal(beaconLoads, 0);
      }
      results.push({ hostname, enabled, beaconLoads });
    } finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
  }
  const response = await fetch(new URL('/operation-preview', base));
  assert.equal(response.status, 404, 'Fixture preview must not be available in production');
  console.log(JSON.stringify({ results, productionPreviewStatus: response.status, externalAnalyticsRequests: 0 }, null, 2));
} finally { await browser.close(); }
