import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Read only declared workspace members, never copied manifests in build output. */
export function workspaceVersions(root) {
  const members = JSON.parse(execFileSync('pnpm', ['m', 'ls', '--json', '--depth', '-1'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const versions = new Map();
  for (const member of members) {
    const manifest = JSON.parse(readFileSync(join(member.path, 'package.json'), 'utf8'));
    if (manifest.name?.startsWith('@partylayer/') && manifest.version) {
      if (versions.has(manifest.name)) throw new Error(`Duplicate workspace package: ${manifest.name}`);
      versions.set(manifest.name, manifest.version);
    }
  }
  return versions;
}
