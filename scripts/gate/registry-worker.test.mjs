/**
 * Regression gate: the registry worker's not-found guard.
 *
 * Cloudflare Pages answers ANY unmatched path with the SPA index fallback as a 200.
 * registry/_worker.js turns that into a real 404 for concrete file requests, so a
 * missing manifest or icon cannot be cached as a valid asset. That guard silently
 * stopped working once: it identified the fallback by Content-Type, while
 * registry/_headers rewrites Content-Type to application/json for /*.json and
 * /*.sig, which are exactly the paths it protects. Production served
 * `/v1/stable/registry.sig` and any missing .json as HTTP 200 with an HTML body and
 * a five minute cache.
 *
 * This exercises the real worker module against a stub that reproduces both Pages
 * behaviors: the index fallback, and the _headers Content-Type rewrite that defeated
 * the old check. Run via `pnpm gate:registry`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = join(ROOT, 'registry');

const worker = (await import(join(SITE, '_worker.js'))).default;

/**
 * Content-Type that registry/_headers forces onto a path, if any. It rewrites ONLY
 * /*.json and /*.sig; the /wallets/* rule sets caching and robots, not a type. That
 * asymmetry is the whole bug: a missing icon kept text/html and was caught, while a
 * missing manifest was relabelled application/json and slipped through.
 */
function headersContentType(pathname) {
  if (pathname.endsWith('.json') || pathname.endsWith('.sig')) return 'application/json; charset=utf-8';
  return undefined;
}

/** Content-Type Pages derives from the extension of a file that really exists. */
function typeByExtension(pathname) {
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg')) return 'image/jpeg';
  if (pathname.endsWith('.md')) return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}

/**
 * Stub of Pages' static asset server: serve the file when it exists, otherwise the
 * index.html fallback as a 200, then apply the _headers Content-Type rewrite exactly
 * as Pages does.
 */
const env = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const candidate = join(SITE, normalize(pathname));
      const exists = candidate.startsWith(SITE) && existsSync(candidate) && statSync(candidate).isFile();
      const body = readFileSync(exists ? candidate : join(SITE, 'index.html'));
      const type = headersContentType(pathname) ?? (exists ? typeByExtension(pathname) : 'text/html; charset=utf-8');
      return new Response(body, { status: 200, headers: { 'Content-Type': type } });
    },
  },
};

const call = (path, method = 'GET') =>
  worker.fetch(new Request(`https://registry.partylayer.xyz${path}`, { method }), env, {});

test('a nonexistent .json path returns an uncacheable 404, not the HTML fallback', async () => {
  const res = await call('/v1/stable/does-not-exist.json');
  assert.equal(res.status, 404, 'a missing .json must be a 404');
  assert.equal(res.headers.get('cache-control'), 'no-store', 'a 404 must not be cacheable');
  const text = await res.text();
  assert.ok(!/<!doctype html/i.test(text), 'the HTML fallback must never be served as the body');
  assert.equal(JSON.parse(text).error, 'Not Found');
});

test('a nonexistent .sig path returns 404', async () => {
  // registry.sig is not a file in this repo, so the signature URL the registry client
  // builds must answer 404 rather than 200 with HTML that JSON.parse would choke on.
  const res = await call('/v1/stable/registry.sig');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('a nonexistent icon returns 404', async () => {
  const res = await call('/wallets/missing-icon.png');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('HEAD for a nonexistent .json returns 404 with no body', async () => {
  // HEAD carries no body to sniff, so the guard must fetch the asset as GET to decide.
  const res = await call('/v1/stable/does-not-exist.json', 'HEAD');
  assert.equal(res.status, 404);
  assert.equal(await res.text(), '');
});

test('existing files are untouched: served 200 with their real body', async () => {
  for (const path of ['/v1/stable/registry.json', '/v1/beta/registry.json', '/health.json', '/wallets.json']) {
    const res = await call(path);
    assert.equal(res.status, 200, `${path} must still be served`);
    const parsed = JSON.parse(await res.text());
    assert.ok(parsed && typeof parsed === 'object', `${path} must still be real JSON`);
  }
  const icon = await call('/wallets/console.png');
  assert.equal(icon.status, 200, 'a present icon must still be served');
});

test('every icon the stable manifest claims is present and served', async () => {
  const registry = JSON.parse(readFileSync(join(SITE, 'v1/stable/registry.json'), 'utf8'));
  for (const wallet of registry.wallets) {
    if (!wallet.icon) continue;
    const path = new URL(wallet.icon).pathname;
    const res = await call(path);
    assert.equal(res.status, 200, `${wallet.id} claims ${path}, which the registry does not serve`);
  }
});
