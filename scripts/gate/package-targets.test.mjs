import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingDeclaredTargets } from './package-targets.mjs';

test('archive check rejects a missing private conditional target even when public entries exist', () => {
  const pkg = { exports: { '.': { import: './dist/index.mjs', require: './dist/index.cjs' } },
    imports: { '#profile': { types: './dist/profile.d.ts', import: './dist/profile.mjs', require: './dist/profile.cjs' } } };
  const packedFiles = new Set(['dist/index.mjs', 'dist/index.cjs', 'dist/profile.d.ts', 'dist/profile.mjs']);
  assert.deepEqual(missingDeclaredTargets(pkg, packedFiles), ['dist/profile.cjs']);
  packedFiles.add('dist/profile.cjs');
  assert.deepEqual(missingDeclaredTargets(pkg, packedFiles), []);
});

test('private imports may route to an external dependency rather than an archive file', () => {
  assert.deepEqual(missingDeclaredTargets({ imports: { '#transport': { node: 'external-transport', default: null } } }, new Set()), []);
});
