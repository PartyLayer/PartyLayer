#!/usr/bin/env node
/**
 * Pre-publish validation for the @partylayer monorepo.
 *
 * Enforces two invariants for every published (non-private) workspace package:
 *
 *   1. Symbol coherence: every `@partylayer/*` symbol imported in dist/ is
 *      actually exported by the workspace source it claims to come from.
 *
 *   2. Version coherence: every `@partylayer/*` entry in dependencies /
 *      peerDependencies / optionalDependencies has a range that is
 *      satisfied by the current workspace version of that dependency.
 *
 * Exits 0 on success, 1 on any violation. Designed to be safe to run
 * before `pnpm changeset publish` and inside CI.
 *
 * Discovery: uses `pnpm m ls --json --depth -1` as the source of truth
 * for workspace membership — survives any future repo restructuring.
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ---------- workspace discovery ----------
let wsRaw;
try {
  wsRaw = execSync('pnpm m ls --json --depth -1', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
} catch (err) {
  console.error('✗ validate-publish: could not run `pnpm m ls --json --depth -1`.');
  console.error(err.stderr?.toString() || err.message);
  process.exit(2);
}
const wsList = JSON.parse(wsRaw);

const workspacePackages = {};
for (const p of wsList) {
  if (!p.name?.startsWith('@partylayer/')) continue;
  if (p.private) continue;
  if (!p.version) continue;
  workspacePackages[p.name] = {
    name: p.name,
    dir: p.path,
    version: p.version,
    pkgJson: JSON.parse(readFileSync(join(p.path, 'package.json'), 'utf8')),
  };
}

// ---------- helpers ----------
function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const violations = [];
function report(kind, pkg, detail, file) {
  violations.push({ kind, pkg, detail, file });
}

// ---------- export extraction ----------
//
// We read .d.ts (and .d.mts/.d.cts) for the authoritative export list.
// Bundlers may tree-shake or minify .js, but .d.ts is the public-API
// contract; if a symbol exists in .d.ts, consumers can import it.
//
function getExports(pkg) {
  const distDir = join(pkg.dir, 'dist');
  if (!existsSync(distDir)) {
    report('no-dist', pkg.name, `dist/ does not exist. Run \`pnpm build\` before validating.`);
    return { named: new Set(), hasDefault: false };
  }
  const named = new Set();
  let hasDefault = false;
  const reExports = []; // [{file, source}]

  for (const file of walk(distDir)) {
    if (!/\.d\.(c|m)?ts$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');

    // Strip block & line comments to avoid false matches.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // export { A, B as C }
    for (const m of stripped.matchAll(/export\s*\{([^}]+)\}\s*(?:from\s*["'][^"']+["'])?\s*;?/g)) {
      for (const part of m[1].split(',')) {
        const cleaned = part.trim();
        if (!cleaned) continue;
        // Drop leading `type` keyword in `export { type X }` syntax
        const noType = cleaned.replace(/^type\s+/, '');
        const after = noType.split(/\s+as\s+/);
        const exportedName = after[after.length - 1].trim();
        if (exportedName === 'default') {
          hasDefault = true;
        } else if (exportedName) {
          named.add(exportedName);
        }
      }
    }

    // export const|let|var|function|class|type|interface|enum|namespace|abstract class|async function NAME
    const declRe = /export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function|class|type|interface|enum|namespace)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    for (const m of stripped.matchAll(declRe)) {
      named.add(m[1]);
    }

    // export default ...
    if (/export\s+default\b/.test(stripped)) hasDefault = true;

    // export * from "..."   and   export * as ns from "..."
    for (const m of stripped.matchAll(/export\s+\*(?:\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))?\s+from\s+["']([^"']+)["']/g)) {
      const nsName = m[1];
      const source = m[2];
      if (nsName) {
        // export * as ns from "x" — just adds `ns` as a named export
        named.add(nsName);
      } else {
        // export * from "x" — defer; we'll union after all packages processed
        reExports.push({ source });
      }
    }
  }

  return { named, hasDefault, reExports };
}

// ---------- import extraction ----------
//
// Read every JS/CJS/MJS/D.TS file in dist/ and collect every @partylayer/*
// import / require / re-export.
//
function getImports(pkg) {
  const distDir = join(pkg.dir, 'dist');
  if (!existsSync(distDir)) return [];
  const out = [];

  for (const file of walk(distDir)) {
    if (!/\.(c|m)?js$|\.d\.(c|m)?ts$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // ESM: import { A, B as C } from "@partylayer/x"
    // ESM: import D from "@partylayer/x"
    // ESM: import * as ns from "@partylayer/x"
    // ESM: import D, { A } from "@partylayer/x"
    // ESM: import "@partylayer/x"  (side-effect only — no symbols)
    // ESM re-export: export { A } from "@partylayer/x"
    // ESM re-export: export * from "@partylayer/x"
    const esmRe = /(?:import|export)\s+(?:(?:([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*)?(\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)|\{([^}]+)\}|([A-Za-z_$][A-Za-z0-9_$]*))?\s*(?:from\s*)?)?["'](@partylayer\/[a-z0-9-]+)["']/g;
    for (const m of stripped.matchAll(esmRe)) {
      const [, defaultBeforeBrace, , nsAlias, braceList, defaultOnly, source] = m;
      if (!source) continue;
      const symbols = [];
      let importsDefault = false;
      let importsNamespace = false;

      if (defaultBeforeBrace) importsDefault = true;
      if (defaultOnly && !nsAlias && !braceList) importsDefault = true;
      if (nsAlias) importsNamespace = true;
      if (braceList) {
        for (const part of braceList.split(',')) {
          const cleaned = part.trim().replace(/^type\s+/, '');
          if (!cleaned) continue;
          const first = cleaned.split(/\s+as\s+/)[0].trim();
          if (first) symbols.push(first);
        }
      }

      out.push({ from: source, symbols, importsDefault, importsNamespace, file });
    }

    // CJS: const X = require("@partylayer/x")
    // CJS: const { A, B } = require("@partylayer/x")
    const cjsRe = /require\s*\(\s*["'](@partylayer\/[a-z0-9-]+)["']\s*\)/g;
    for (const m of stripped.matchAll(cjsRe)) {
      // We can't easily know which symbols are pulled (destructure is on the LHS).
      // Treat as namespace import — only validates that the source package exists.
      out.push({ from: m[1], symbols: [], importsDefault: false, importsNamespace: true, file });
    }
  }

  return out;
}

// ---------- build per-package export sets ----------
const exportsByPkg = {};
for (const [name, pkg] of Object.entries(workspacePackages)) {
  exportsByPkg[name] = getExports(pkg);
}

// Resolve `export * from "@partylayer/x"` re-exports by unioning the source's exports.
// Note: re-export chains across multiple workspace packages are resolved in a single pass.
// If A re-exports * from B and B re-exports * from C, after the union A gets C's exports too,
// because B's named set already includes C's by the time we process A. To be order-independent
// we run a fixed-point loop with a small bound.
let changed = true;
let guard = 0;
while (changed && guard < 10) {
  changed = false;
  guard++;
  for (const [name, exp] of Object.entries(exportsByPkg)) {
    if (!exp.reExports) continue;
    for (const re of exp.reExports) {
      const sourceExp = exportsByPkg[re.source];
      if (!sourceExp) continue;
      for (const sym of sourceExp.named) {
        if (!exp.named.has(sym)) {
          exp.named.add(sym);
          changed = true;
        }
      }
      if (sourceExp.hasDefault && !exp.hasDefault) {
        // Note: `export * from` does NOT re-export default in TS/ESM. Don't propagate.
      }
    }
  }
}

// ---------- Check 1: symbol coherence ----------
for (const [name, pkg] of Object.entries(workspacePackages)) {
  const imports = getImports(pkg);
  for (const imp of imports) {
    const sourcePkg = workspacePackages[imp.from];
    if (!sourcePkg) {
      // Importing from a non-workspace @partylayer package — could be a legitimate
      // external @partylayer package (e.g., a deprecated detached package), but
      // far more likely a typo. Surface as a violation.
      report('unknown-source', name, `imports from "${imp.from}" but no such workspace package exists.`, imp.file);
      continue;
    }
    const sourceExp = exportsByPkg[imp.from];
    if (!sourceExp) continue; // already reported as no-dist

    if (imp.importsDefault && !sourceExp.hasDefault) {
      report('missing-default', name, `imports the default export from "${imp.from}" but ${imp.from}@${sourcePkg.version} has no default export.`, imp.file);
    }
    // namespace import doesn't need per-symbol validation
    for (const sym of imp.symbols) {
      if (!sourceExp.named.has(sym)) {
        report('missing-export', name, `imports { ${sym} } from "${imp.from}" but ${imp.from}@${sourcePkg.version} does not export it.`, imp.file);
      }
    }
  }
}

// ---------- Check 2: version range coherence ----------
for (const [name, pkg] of Object.entries(workspacePackages)) {
  const deps = {
    ...(pkg.pkgJson.dependencies ?? {}),
    ...(pkg.pkgJson.peerDependencies ?? {}),
    ...(pkg.pkgJson.optionalDependencies ?? {}),
  };
  for (const [depName, range] of Object.entries(deps)) {
    if (!depName.startsWith('@partylayer/')) continue;
    const depPkg = workspacePackages[depName];
    if (!depPkg) {
      report('unknown-dep', name, `declares dependency on "${depName}" which is not a workspace package.`);
      continue;
    }
    // workspace: protocol is rewritten at publish time by pnpm — treat as always-valid.
    if (typeof range === 'string' && range.startsWith('workspace:')) continue;

    if (!semver.validRange(range)) {
      report('invalid-range', name, `declares "${depName}": "${range}" which is not a valid semver range.`);
      continue;
    }
    if (!semver.satisfies(depPkg.version, range)) {
      report('range-mismatch', name, `declares "${depName}": "${range}" but workspace ${depName} is at ${depPkg.version}. Bump the range (or, if intentional, downgrade the workspace dep).`);
    }
  }
}

// ---------- report ----------
const pkgCount = Object.keys(workspacePackages).length;

if (violations.length === 0) {
  console.log(`✓ validate-publish: all ${pkgCount} published @partylayer/* packages are coherent.`);
  process.exit(0);
}

console.error(`✗ validate-publish: ${violations.length} violation(s) across ${pkgCount} packages.\n`);
for (const v of violations) {
  console.error(`  [${v.kind}] ${v.pkg}`);
  console.error(`    ${v.detail}`);
  if (v.file) console.error(`    file: ${relative(repoRoot, v.file)}`);
  console.error('');
}
process.exit(1);
