import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, markdown, PACKAGES } from './snapshot.mjs';

function fakeFetch({ unavailable = false, mismatchedPackage = false } = {}) {
  return async input => {
    const url = new URL(input);
    let data;
    if (url.hostname === 'api.npmjs.org') {
      const name = decodeURIComponent(url.pathname.split('/').at(-1));
      if (unavailable && name === PACKAGES[0] && url.pathname.includes('last-week')) return { ok: false, status: 503 };
      data = { package: mismatchedPackage ? 'another-package' : name, downloads: 12, start: '2026-10-01', end: '2026-10-07' };
    } else if (url.hostname === 'registry.npmjs.org') {
      data = { name: decodeURIComponent(url.pathname.split('/')[1]), version: '1.0.0', keywords: ['canton'] };
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
