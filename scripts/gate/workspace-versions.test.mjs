import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workspaceVersions } from './workspace-versions.mjs';

test('stale standalone build manifests cannot overwrite current template dependency versions', () => {
  const root = mkdtempSync(join(tmpdir(), 'partylayer-workspace-versions-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'test-workspace', private: true, packageManager: 'pnpm@9.15.9' }));
    writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n  - 'apps/*'\n");
    for (const [path, manifest] of [
      ['packages/sdk', { name: '@partylayer/sdk', version: '0.20.1' }],
      ['apps/demo', { name: 'demo', private: true }],
      ['apps/demo/.next/standalone/packages/sdk', { name: '@partylayer/sdk', version: '0.19.0' }],
    ]) {
      const dir = join(root, path); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
    }
    assert.deepEqual([...workspaceVersions(root)], [['@partylayer/sdk', '0.20.1']]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
