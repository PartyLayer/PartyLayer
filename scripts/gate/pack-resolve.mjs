#!/usr/bin/env node
/**
 * Shared helper: resolve a packed tarball's entry points the way a consumer would.
 *
 * Asserting that a file named in `exports` exists is not enough. A package can name a file
 * that exists and still be unusable, which is exactly what happened here: a `tsc` build
 * emitted ESM carrying extensionless relative specifiers, so the entry file was present but
 * Node could not load what it imported. Existence is a spelling check; this is the real one.
 *
 * For each consumer-visible specifier it runs a real `import()` and, where the package
 * declares a `require` condition, a real `require()`, from a directory whose node_modules
 * mirrors the workspace's, so the package's own dependencies resolve exactly as they will
 * for a consumer who installed them.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, symlinkSync, rmSync, mkdtempSync, cpSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Build a directory whose node_modules mirrors the workspace's by symlink, then COPY the
 * unpacked tarball in as the package under test. Mirroring rather than reusing the real
 * node_modules means nothing in the workspace is mutated.
 *
 * The package under test is copied rather than symlinked on purpose. Node's ESM resolver
 * works from a module's real path, so a symlinked package would look for its own
 * dependencies next to the temporary unpack directory, where there is no node_modules, and
 * every package with dependencies would fail for a reason that has nothing to do with it.
 */
function makeSandbox(repoRoot, packageName, unpackedDir) {
  const sandbox = mkdtempSync(join(tmpdir(), 'pl-resolve-'));
  const realModules = join(repoRoot, 'node_modules');
  const sandboxModules = join(sandbox, 'node_modules');
  mkdirSync(sandboxModules);

  const [scope, bare] = packageName.startsWith('@')
    ? [packageName.split('/')[0], packageName.split('/')[1]]
    : [null, packageName];

  for (const entry of readdirSync(realModules)) {
    if (entry === scope) continue; // rebuilt below so the package under test can be swapped in
    if (!scope && entry === bare) continue; // the unscoped package under test is copied in
    try {
      symlinkSync(join(realModules, entry), join(sandboxModules, entry), 'junction');
    } catch {
      /* a name that cannot be linked is not one the package under test needs */
    }
  }

  if (scope) {
    const scopeDir = join(sandboxModules, scope);
    mkdirSync(scopeDir);
    const realScope = join(realModules, scope);
    if (existsSync(realScope)) {
      for (const entry of readdirSync(realScope)) {
        if (entry === bare) continue;
        try {
          symlinkSync(join(realScope, entry), join(scopeDir, entry), 'junction');
        } catch {
          /* as above */
        }
      }
    }
    cpSync(unpackedDir, join(scopeDir, bare), { recursive: true });
  } else {
    cpSync(unpackedDir, join(sandboxModules, bare), { recursive: true });
  }

  return sandbox;
}

/** The specifiers a consumer can write, and which module systems the manifest promises. */
export function consumerSpecifiers(pkg) {
  const out = [];
  const conditionsOf = (node) => {
    if (typeof node === 'string') return { esm: true, cjs: true };
    if (!node || typeof node !== 'object') return null;
    const keys = Object.keys(node);
    // A nested condition object still resolves through import/require at the top level.
    return {
      esm: keys.includes('import') || keys.includes('default') || keys.includes('node'),
      cjs: keys.includes('require'),
    };
  };

  if (pkg.exports && typeof pkg.exports === 'object' && !Array.isArray(pkg.exports)) {
    const keys = Object.keys(pkg.exports);
    const isSubpathMap = keys.some((k) => k.startsWith('.'));
    if (isSubpathMap) {
      for (const [subpath, node] of Object.entries(pkg.exports)) {
        const conditions = conditionsOf(node);
        if (!conditions) continue;
        const spec = subpath === '.' ? pkg.name : `${pkg.name}${subpath.replace(/^\./, '')}`;
        out.push({ spec, ...conditions });
      }
    } else {
      const conditions = conditionsOf(pkg.exports);
      if (conditions) out.push({ spec: pkg.name, ...conditions });
    }
  } else if (typeof pkg.exports === 'string') {
    out.push({ spec: pkg.name, esm: true, cjs: true });
  } else if (pkg.main || pkg.module) {
    // No exports map: the bare specifier resolves through `main`, in both systems unless
    // the package declares itself ESM only.
    out.push({ spec: pkg.name, esm: true, cjs: pkg.type !== 'module' });
  }
  return out;
}

/** Failures that mean an entry point is genuinely unloadable. */
const REAL_FAILURES = [
  'ERR_MODULE_NOT_FOUND',
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
  'ERR_UNSUPPORTED_DIR_IMPORT',
  'ERR_UNKNOWN_FILE_EXTENSION',
  'ERR_INVALID_PACKAGE_TARGET',
  'SyntaxError',
];

/**
 * Whether a failure belongs to the package under test rather than to something it imports.
 *
 * A package may legitimately fail to load in plain Node because a PEER cannot. Importing
 * @partylayer/react-native pulls in react-native, whose published source is Flow, so Node
 * raises a SyntaxError in react-native's own file. That says nothing about our packaging,
 * and it must not be reported as our defect.
 *
 * So the question is never "does our name appear in the stack", which it always will, it is
 * "which file actually failed". A missing module is ours when the missing path is inside our
 * directory; a syntax error is ours when the file that threw is inside our directory.
 */
function classify(stderr, spec, ownDir) {
  const marker = REAL_FAILURES.find((m) => stderr.includes(m));
  if (!marker) return null;

  // The specifier itself never resolved: unambiguously ours.
  if (stderr.includes(`Cannot find package '${spec}'`)) return marker;

  // A missing module: ours only when the missing path is inside our directory.
  const missing = /Cannot find module '([^']+)'/.exec(stderr);
  if (missing) return missing[1].startsWith(ownDir) ? marker : null;

  // A parse failure: Node prints "<file>:<line>" before the code frame. Ours only when
  // that file is inside our directory.
  const offending = /^(\/[^\n:]+):\d+$/m.exec(stderr);
  if (offending) return offending[1].startsWith(ownDir) ? marker : null;

  // Unattributable: do not blame the package under test.
  return null;
}

/**
 * Resolve every consumer specifier of an unpacked package. Returns a list of problems;
 * an empty list means every entry point loaded.
 */
export function resolveEntryPoints(repoRoot, pkg, unpackedDir) {
  const sandbox = makeSandbox(repoRoot, pkg.name, unpackedDir);
  // Node reports real paths. On macOS the temp dir is /var/... but resolves to
  // /private/var/..., so comparing against the unresolved path silently never matches and
  // every real failure would be dismissed as someone else's.
  const ownDir = join(realpathSync(sandbox), 'node_modules', ...pkg.name.split('/'));
  const problems = [];
  try {
    for (const { spec, esm, cjs } of consumerSpecifiers(pkg)) {
      if (esm) {
        try {
          execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(spec)})`], {
            cwd: sandbox,
            stdio: 'pipe',
            encoding: 'utf8',
            timeout: 30_000,
          });
        } catch (error) {
          const stderr = String(error.stderr ?? error.message ?? '');
          const kind = classify(stderr, spec, ownDir);
          if (kind) {
            problems.push(`import("${spec}") fails with ${kind}: ${firstLine(stderr)}`);
          }
        }
      }
      if (cjs) {
        try {
          execFileSync(process.execPath, ['-e', `require(${JSON.stringify(spec)})`], {
            cwd: sandbox,
            stdio: 'pipe',
            encoding: 'utf8',
            timeout: 30_000,
          });
        } catch (error) {
          const stderr = String(error.stderr ?? error.message ?? '');
          const kind = classify(stderr, spec, ownDir);
          if (kind) {
            problems.push(`require("${spec}") fails with ${kind}: ${firstLine(stderr)}`);
          }
        }
      }
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
  return problems;
}

/** The human-readable reason, not a frame of Node's own internals. */
function firstLine(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const named =
    lines.find((l) => /^(Error|TypeError|SyntaxError)\b.*\[?ERR_/.test(l)) ??
    lines.find((l) => /^Cannot find (module|package)/.test(l)) ??
    lines.find((l) => /^(Error|SyntaxError|TypeError)\b/.test(l));
  return (named ?? lines.find((l) => l) ?? '').slice(0, 180);
}

export { resolve as resolvePath };
