import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { snapshot, markdown, PACKAGES, SEARCH_QUERIES, readSearchResults } from './snapshot.mjs';

function fakeFetch({ unavailable = false, mismatchedPackage = false, unavailableSearch = false } = {}) {
  return async input => {
    const url = new URL(input);
    let data;
    if (url.hostname === 'api.npmjs.org') {
      const name = decodeURIComponent(url.pathname.split('/').at(-1));
      if (unavailable && name === PACKAGES[0] && url.pathname.includes('last-week')) return { ok: false, status: 503 };
      data = { package: mismatchedPackage ? 'another-package' : name, downloads: 12, start: '2026-10-01', end: '2026-10-07' };
    } else if (url.hostname === 'registry.npmjs.org') {
      if (url.pathname === '/-/v1/search') {
        if (unavailableSearch && url.searchParams.get('text') === SEARCH_QUERIES[0]) return {ok:false,status:503};
        data = {total:3,objects:[{package:{name:'another-package'}},{package:{name:PACKAGES[0]}},{package:{name:PACKAGES[1]}}]};
      } else data = { name: decodeURIComponent(url.pathname.split('/')[1]), version: '1.0.0', keywords: ['canton'] };
    } else data = { full_name: 'PartyLayer/PartyLayer', stargazers_count: 5, forks_count: 2, open_issues_count: 1 };
    return { ok: true, json: async () => data };
  };
}

test('a failed download source remains missing while other sources survive', async () => {
  const report = await snapshot({ fetcher: fakeFetch({ unavailable: true }) });
  assert.equal(report.complete, false);
  assert.equal(report.packages[0].week, null);
  assert.equal(report.packages[0].month.downloads, 12);
  assert.equal(report.packages[1].week.downloads, 12);
  assert.equal(report.failures.length, 1);
  assert.match(markdown(report), /unavailable/);
  assert.match(markdown(report), /partial/);
});

test('download data for another package cannot be attributed to PartyLayer', async () => {
  const report = await snapshot({ fetcher: fakeFetch({ mismatchedPackage: true }) });
  assert.equal(report.complete, false);
  assert.ok(report.packages.every(p => p.week === null && p.month === null));
});

test('reported date windows and separate package counts survive unchanged', async () => {
  const report = await snapshot({ fetcher: fakeFetch(), now: new Date('2026-10-24T12:00:00Z') });
  assert.equal(report.complete, true);
  assert.equal(report.packages.length, 3);
  assert.equal(report.packages[0].week.end, '2026-10-07');
  assert.equal(report.collectedAt, '2026-10-24T12:00:00.000Z');
  assert.match(report.interpretation, /Do not sum/);
  assert.doesNotMatch(markdown(report), /36 downloads|unique users: 36/);
});

test('search samples distinguish observed positions, absent entry points and unavailable sources', async () => {
  const report = await snapshot({fetcher:fakeFetch({unavailableSearch:true})});
  assert.equal(report.complete,false);
  assert.equal(report.npmSearch[0].result,null);
  const second = report.npmSearch[1].result;
  assert.equal(second.entryPoints[0].position,2);
  assert.equal(second.entryPoints[2].position,null);
  assert.equal(second.entryPoints[2].notFoundInSample,true);
  assert.ok(report.packages.every(item => item.latest !== null));
  assert.match(markdown(report), /not observed in 3 returned results/);
  assert.match(markdown(report), /not npm website ordering/);
  assert.ok(report.failures.some(item => item.source === `npm:search:${SEARCH_QUERIES[0]}`));
});

test('malformed or repeated npm search rows cannot produce a trustworthy position', () => {
  assert.throws(() => readSearchResults({total:2,objects:[{package:{name:PACKAGES[0]}},{package:{name:PACKAGES[0]}}]},SEARCH_QUERIES[0]),/Invalid npm search/);
  assert.throws(() => readSearchResults({total:1,objects:[{package:{}}]},SEARCH_QUERIES[0]),/Invalid npm search/);
});

import { siteHealth, inspectPage, REQUIRED_PATHS, AI_REFERENCE_PATHS, healthMarkdown } from './site-health.mjs';

function siteFixture({badCanonical = false, noindex = false, external = false, unavailable = false, blocked = false, missing = false, staleReference = false, unavailableReference = false, challengeReference = false} = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'manual');
    const referencePath = new URL(url).pathname;
    if (AI_REFERENCE_PATHS.includes(referencePath)) {
      if (unavailableReference && referencePath === '/llms-full.txt') return new Response('Unavailable',{status:503});
      const body = readFileSync(new URL(`../../apps/demo/public${referencePath}`, import.meta.url),'utf8');
      return new Response(challengeReference ? '<html>Please wait</html>' : staleReference ? '# Old installation guide' : body, {headers:{'content-type':challengeReference ? 'text/html' : 'text/plain'}});
    }
    if (url.endsWith('/robots.txt')) return new Response(`User-Agent: *\n${blocked ? 'Disallow: /docs' : 'Allow: /\nDisallow:'}\nSitemap: https://partylayer.xyz/sitemap.xml\n`, {headers:{'content-type':'text/plain'}});
    if (url.endsWith('/sitemap.xml')) {
      const paths = REQUIRED_PATHS.filter(path => !missing || path !== '/docs/quick-start');
      const locs = paths.map(path => `<url><loc>https://partylayer.xyz${path}</loc></url>`).join('');
      return new Response(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs}${external ? '<url><loc>https://outside.example/private</loc></url>' : ''}</urlset>`, {headers:{'content-type':'application/xml'}});
    }
    if (unavailable && url.endsWith('/docs/quick-start')) return new Response('temporary error',{status:503});
    const canonical = badCanonical && url.endsWith('/docs/quick-start') ? 'https://partylayer.xyz/' : url;
    return new Response(`<html><head><title>Canton &amp; React</title><link href='${canonical}' rel='canonical'>${noindex ? '<meta content="noindex" name="robots">' : ''}</head><body><h1>Canton wallet kit</h1></body></html>`, {headers:{'content-type':'text/html'}});
  };
  return {fetcher,calls};
}

test('live site checks preserve successful pages and expose unavailable routes without zeros', async () => {
  const report = await siteHealth(siteFixture({unavailable:true}));
  assert.equal(report.passed,false);
  assert.equal(report.pages.find(page => page.url.endsWith('/quick-start')).status,null);
  assert.ok(report.pages.some(page => page.failures.length === 0));
  assert.ok(report.failures.some(item => /HTTP 503/.test(item.error)));
});

test('a successful challenge page or incorrect canonical cannot look healthy', async () => {
  const challenge = inspectPage('<html><head><title>Just a moment</title></head><body>Challenge</body></html>','https://partylayer.xyz/docs');
  assert.ok(challenge.failures.some(item => /Canonical/.test(item)));
  assert.equal((await siteHealth(siteFixture({badCanonical:true}))).passed,false);
  assert.equal((await siteHealth(siteFixture({noindex:true}))).passed,false);
  assert.ok(inspectPage('<head><title>Docs</title><link rel="canonical" href="https://partylayer.xyz/docs"></head>','https://partylayer.xyz/docs',new Headers({'x-robots-tag':'googlebot: noindex'})).noindex);
});

test('sitemap content cannot redirect the monitor to external hosts', async () => {
  const fixture = siteFixture({external:true});
  const report = await siteHealth(fixture);
  assert.equal(report.passed,false);
  assert.ok(report.failures.some(item => /external sitemap URL/.test(item.error)));
  assert.ok(fixture.calls.every(url => new URL(url).origin === 'https://partylayer.xyz'));
});

test('crawl-policy changes and missing primary installation pages require review', async () => {
  assert.equal((await siteHealth(siteFixture({blocked:true}))).passed,false);
  const missing = await siteHealth(siteFixture({missing:true}));
  assert.equal(missing.passed,false);
  assert.ok(missing.failures.some(item => item.error === 'Critical entry point missing: /docs/quick-start'));
});

test('healthy sitemap routes pass without implying Google index or ranking results', async () => {
  const report = await siteHealth(siteFixture());
  assert.equal(report.passed,true);
  assert.equal(report.pageCount,REQUIRED_PATHS.length);
  assert.equal(report.pages[0].title,'Canton & React');
  assert.match(report.interpretation,/not Googlebot verification/);
  assert.ok(report.references.every(reference => reference.matchesRepository));
  assert.match(healthMarkdown(report), /2\/2 AI references match/);
});

test('HTTP 200 with outdated AI installation instructions fails the deployed-reference check', async () => {
  const report = await siteHealth(siteFixture({staleReference:true}));
  assert.equal(report.passed,false);
  assert.equal(report.references[0].matchesRepository,false);
  assert.notEqual(report.references[0].sha256,report.references[0].expectedSha256);
  assert.ok(report.failures.some(item => /AI reference differs/.test(item.error)));
  assert.ok(report.pages.every(page => page.failures.length === 0));
});

test('missing or challenged AI references stay visible while page evidence survives', async () => {
  const unavailable = await siteHealth(siteFixture({unavailableReference:true}));
  assert.equal(unavailable.passed,false);
  assert.equal(unavailable.references.find(reference => reference.url.endsWith('/llms-full.txt')).sha256,null);
  assert.equal(unavailable.references[0].matchesRepository,true);
  assert.match(healthMarkdown(unavailable), /1\/2 AI references match/);
  const challenged = await siteHealth(siteFixture({challengeReference:true}));
  assert.equal(challenged.passed,false);
  assert.ok(challenged.failures.some(item => /Unexpected content type/.test(item.error)));
});
