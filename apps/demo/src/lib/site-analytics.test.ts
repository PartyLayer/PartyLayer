import { test } from 'node:test';
import assert from 'node:assert/strict';
import { websiteAnalyticsEnabled } from './site-analytics';

const fixtureToken = '0123456789abcdef0123456789abcdef';
test('website analytics is confined to the two production website hostnames with a valid public site id', () => {
  for (const hostname of ['partylayer.xyz', 'www.partylayer.xyz']) assert.equal(websiteAnalyticsEnabled(fixtureToken, hostname, 'production'), true);
  for (const hostname of ['localhost', '127.0.0.1', 'registry.partylayer.xyz', 'partylayer-preview.vercel.app', 'partylayer.xyz.example.com', 'fakepartylayer.xyz']) {
    assert.equal(websiteAnalyticsEnabled(fixtureToken, hostname, 'production'), false);
  }
  for (const environment of ['development', 'test', undefined]) assert.equal(websiteAnalyticsEnabled(fixtureToken, 'partylayer.xyz', environment), false);
  for (const token of [undefined, '', 'not-a-site-id', `${fixtureToken}x`]) assert.equal(websiteAnalyticsEnabled(token, 'partylayer.xyz', 'production'), false);
});
