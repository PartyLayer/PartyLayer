import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

type Manifest = {
  name?: string; version?: string; engines?: { node?: string };
  dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};
type Installed = { manifest: Manifest; path: string };
type Check = { id: string; severity: 'pass' | 'warning' | 'error'; message: string; remediation?: string };
const INTEGRATIONS = ['@partylayer/react', '@partylayer/sdk', '@partylayer/vue', '@partylayer/react-native', '@partylayer/provider', '@partylayer/session'];
const SAFE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i;

function readManifest(path: string): Manifest {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid manifest');
  const manifest = parsed as Manifest;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const value = manifest[field];
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => typeof item !== 'string'))) throw new Error('Invalid dependency map');
  }
  return manifest;
}

/** Resolve metadata only. Never import/require the selected app or its dependencies. */
function installed(name: string, from: string): Installed | undefined {
  if (!SAFE_NAME.test(name)) return undefined;
  const resolver = createRequire(from);
  try {
    let dir = dirname(resolver.resolve(name));
    while (true) {
      const path = join(dir, 'package.json');
      if (existsSync(path)) {
        const manifest = readManifest(path);
        if (manifest.name === name) return { manifest, path: realpathSync(path) };
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* Package exports may hide metadata or the entry may not be built. */ }
  for (const base of resolver.resolve.paths(name) ?? []) {
    const path = join(base, name, 'package.json');
    try {
      const manifest = readManifest(path);
      if (manifest.name === name) return { manifest, path: realpathSync(path) };
    } catch { /* Continue through Node's normal lookup locations. */ }
  }
  return undefined;
}

export function runDoctor(projectDir: string) {
  const tool = readManifest(fileURLToPath(new URL('../package.json', import.meta.url)));
  const checks: Check[] = [];
  const add = (id: string, severity: Check['severity'], message: string, remediation?: string) => {
    checks.push({ id, severity, message, ...(remediation ? { remediation } : {}) });
  };
  const finish = () => {
    const errors = checks.filter(check => check.severity === 'error').length;
    const warnings = checks.filter(check => check.severity === 'warning').length;
    return { schemaVersion: 1, toolVersion: tool.version!, checks, summary: { status: errors ? 'error' : warnings ? 'warning' : 'pass', errors, warnings } };
  };
  const engine = (name: string, manifest: Manifest) => {
    const range = manifest.engines?.node;
    if (typeof range !== 'string' || !semver.validRange(range)) return;
    const ok = semver.satisfies(process.versions.node, range);
    add(`node:${name}`, ok ? 'pass' : 'error', `${name}: Node ${process.versions.node} ${ok ? 'meets' : 'does not meet'} its engine requirement.`, ok ? undefined : 'Use a supported Node LTS version accepted by this package, then reinstall dependencies.');
  };
  engine('create-partylayer-app', tool);
  const manifestPath = join(projectDir, 'package.json');
  let project: Manifest;
  try { project = readManifest(manifestPath); }
  catch {
    add('project', 'error', 'No readable, valid package.json in the selected directory.', 'Run --doctor from the application root, or pass its directory. Repair invalid JSON before retrying.');
    return finish();
  }
  add('project', 'pass', 'Application package.json is readable.');
  engine('application', project);
  const declared = { ...project.peerDependencies, ...project.devDependencies, ...project.dependencies };
  const names = INTEGRATIONS.filter(name => name in declared);
  if (!names.length) add('integration', 'error', 'No supported PartyLayer entry package is declared.', 'For a React app: npm install @partylayer/react @tanstack/react-query. For other stacks, follow https://partylayer.xyz/docs/installation.');
  const compare = (id: string, name: string, dependency: Installed, range: string) => {
    const version = dependency.manifest.version;
    if (!version || !semver.valid(version)) {
      add(id, 'warning', `${name}: installed version metadata is not valid SemVer.`, 'Check local/workspace package metadata and build it before consuming it.');
    } else if (!semver.validRange(range)) {
      add(id, 'warning', `${name}: local, tagged or non-SemVer dependency specification cannot be compared offline.`, 'Verify the resolved package and lockfile with your package manager.');
    } else {
      const ok = semver.satisfies(version, range);
      add(id, ok ? 'pass' : 'error', `${name} ${version} ${ok ? 'matches' : 'does not match'} its declared requirement.`, ok ? undefined : 'Reinstall using the existing lockfile; resolve the version mismatch before changing versions.');
    }
  };
  for (const name of names) {
    const dependency = installed(name, manifestPath);
    if (!dependency) {
      add(`installed:${name}`, 'error', `${name} is declared but its installed metadata cannot be resolved.`, 'Run your package manager install in the application workspace, then retry.');
      continue;
    }
    compare(`installed:${name}`, name, dependency, declared[name]!);
    engine(name, dependency.manifest);
    for (const [peer, range] of Object.entries(dependency.manifest.peerDependencies ?? {})) {
      if (!SAFE_NAME.test(peer)) continue;
      const resolved = installed(peer, dependency.path);
      if (!resolved) {
        if (dependency.manifest.peerDependenciesMeta?.[peer]?.optional) continue;
        add(`peer:${name}:${peer}`, 'error', `${name}: required peer ${peer} is missing.`, `Install a compatible ${peer} version in the application workspace; check the package's peerDependencies.`);
      } else {
        compare(`peer:${name}:${peer}`, peer, resolved, range);
        if (peer === 'react' || peer === 'react-dom' || peer === '@tanstack/react-query') {
          const appPeer = installed(peer, manifestPath);
          if (appPeer && declared[peer]) compare(`application-peer:${peer}`, peer, appPeer, declared[peer]!);
          if (appPeer && appPeer.path !== resolved.path) add(`duplicate:${name}:${peer}`, 'error', `${name} and the application resolve different copies of ${peer}.`, 'Align workspace dependencies and deduplicate this context package with your package manager.');
        }
      }
    }
    const minimum = name === '@partylayer/react' ? '3.1.2' : name === '@partylayer/sdk' ? '0.20.1' : undefined;
    if (minimum && dependency.manifest.version && semver.valid(dependency.manifest.version) && semver.lt(dependency.manifest.version, minimum)) {
      add(`migration:${name}`, 'warning', `${name} predates the current integration guide baseline (${minimum}).`, 'Review https://partylayer.xyz/docs/migration before upgrading. This offline check does not query npm latest.');
    }
  }
  for (const framework of ['next', 'vite', 'nuxt']) {
    if (framework in declared) {
      const dependency = installed(framework, manifestPath);
      if (dependency) engine(framework, dependency.manifest);
    }
  }
  const locks = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'].filter(file => existsSync(join(projectDir, file)));
  const families = new Set(locks.map(file => file.startsWith('npm-') || file === 'package-lock.json' ? 'npm' : file.startsWith('bun.') ? 'bun' : file.split('-')[0]?.split('.')[0]));
  if (families.size > 1) add('lockfiles', 'warning', 'Lockfiles from multiple package managers exist in this application directory.', 'Choose the application package manager and reconcile stale lockfiles with your team. Doctor does not delete files.');
  else add('lockfiles', 'pass', locks.length ? 'No competing application lockfile families found.' : 'No application lockfile found; a workspace root may own it.');
  add('scope', 'pass', 'Read-only metadata checks completed; no project code, install scripts, credentials or network requests were used.');
  return finish();
}
