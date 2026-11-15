import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packagingSnapshot } from './api-packaging.mjs';

const base = { name: '@fixture/package', main: './index.js', types: './index.d.ts' };

test('ordinary peer dependency and metadata maps stay stable when their keys reorder', () => {
  const first = { ...base, peerDependencies: { zebra: '^1', alpha: '^2' }, peerDependenciesMeta: { zebra: { optional: true }, alpha: { optional: false } } };
  const second = { ...base, peerDependencies: { alpha: '^2', zebra: '^1' }, peerDependenciesMeta: { alpha: { optional: false }, zebra: { optional: true } } };
  assert.equal(packagingSnapshot(first), packagingSnapshot(second));
});

test('default/import condition order is an observable exports change', () => {
  const before = { ...base, exports: { '.': { default: './fallback.js', import: './esm.js' } } };
  const after = { ...base, exports: { '.': { import: './esm.js', default: './fallback.js' } } };
  assert.notEqual(packagingSnapshot(before), packagingSnapshot(after));
});

test('nested browser/react-native condition order is retained recursively', () => {
  const before = { ...base, exports: { '.': { import: { browser: './web.js', 'react-native': './native.js', default: './other.js' } } } };
  const after = { ...base, exports: { '.': { import: { 'react-native': './native.js', browser: './web.js', default: './other.js' } } } };
  assert.notEqual(packagingSnapshot(before), packagingSnapshot(after));
  const snapshot = JSON.parse(packagingSnapshot(before));
  assert.deepEqual(Object.keys(snapshot.exports['.'].import), ['browser', 'react-native', 'default']);
});

test('conditional imports have the same order-sensitive protection as exports', () => {
  const before = { ...base, imports: { '#platform': { default: './fallback.js', node: { import: './esm.js', require: './cjs.cjs' } } } };
  const after = { ...base, imports: { '#platform': { node: { import: './esm.js', require: './cjs.cjs' }, default: './fallback.js' } } };
  assert.notEqual(packagingSnapshot(before), packagingSnapshot(after));
});

test('changing optional peer metadata is a packaging contract change', () => {
  const before = { ...base, peerDependencies: { sdk: '^1' }, peerDependenciesMeta: { sdk: { optional: true } } };
  const after = { ...base, peerDependencies: { sdk: '^1' }, peerDependenciesMeta: { sdk: { optional: false } } };
  assert.notEqual(packagingSnapshot(before), packagingSnapshot(after));
});

test('existing manifests without new fields retain the prior packaging form', () => {
  assert.equal(packagingSnapshot({ ...base, version: '9.9.9', peerDependencies: { z: '^1', a: '^2' } }), JSON.stringify({
    main: './index.js', name: '@fixture/package', peerDependencies: { a: '^2', z: '^1' }, types: './index.d.ts',
  }, null, 2) + '\n');
});

test('snapshotting neither reorders nor changes the source package object', () => {
  const pkg = { peerDependenciesMeta: { z: { optional: true }, a: { optional: false } }, exports: { '.': { default: './fallback.js', import: './esm.js' } }, ...base };
  const original = JSON.stringify(pkg);
  packagingSnapshot(pkg);
  assert.equal(JSON.stringify(pkg), original);
});
