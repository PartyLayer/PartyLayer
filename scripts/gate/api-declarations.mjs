/** Snapshot every local declaration reachable from a published type entry. */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { astCanonical } from './api-normalize.mjs';

const isRelative = name => name === '.' || name === '..' || name.startsWith('./') || name.startsWith('../');

function declarationPath(from, specifier) {
  const base = resolve(dirname(from), specifier);
  let candidates;
  if (/\.d\.(?:ts|mts|cts)$/.test(base)) candidates = [base];
  else if (/\.(?:js|jsx|ts|tsx)$/.test(base)) candidates = [base.replace(/\.[^.]+$/, '.d.ts')];
  else if (/\.(?:mjs|mts)$/.test(base)) candidates = [base.replace(/\.[^.]+$/, '.d.mts')];
  else if (/\.(?:cjs|cts)$/.test(base)) candidates = [base.replace(/\.[^.]+$/, '.d.cts')];
  else candidates = [
    `${base}.d.ts`, `${base}.d.mts`, `${base}.d.cts`,
    join(base, 'index.d.ts'), join(base, 'index.d.mts'), join(base, 'index.d.cts'),
  ];
  for (const candidate of candidates) {
    try { if (statSync(candidate).isFile()) return realpathSync(candidate); }
    catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
  }
  throw new Error(`Missing local declaration ${JSON.stringify(specifier)} referenced by ${from}`);
}

function localReferences(source) {
  const references = new Set(source.referencedFiles.map(reference => reference.fileName));
  for (const reference of source.typeReferenceDirectives) {
    if (isRelative(reference.fileName)) references.add(reference.fileName);
  }
  function visit(node) {
    let name;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      name = node.moduleSpecifier.text;
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      name = node.argument.literal.text;
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
               node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      name = node.moduleReference.expression.text;
    }
    if (name && isRelative(name)) references.add(name);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...references].sort();
}

/**
 * Keep the existing root canonical unchanged, then append deterministic file
 * sections for reachable local declarations. Module specifiers stay untouched:
 * aliases and hashed chunk names remain visible parts of the published surface.
 * External packages are deliberately not resolved or snapshotted.
 */
export function declarationCanonical(entryPath) {
  const entry = realpathSync(entryPath);
  const files = new Map();
  function visit(file) {
    if (files.has(file)) return;
    const text = readFileSync(file, 'utf8');
    files.set(file, astCanonical(text)); // mark before traversal: cycles are legal
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const specifier of localReferences(source)) visit(declarationPath(file, specifier));
  }
  visit(entry);
  const chunks = [...files.keys()].filter(file => file !== entry).map(file => ({
    file, name: relative(dirname(entry), file).split('\\').join('/'),
  })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return files.get(entry) + chunks.map(({ file, name }) =>
    `\n// Local declaration: ${JSON.stringify(name)}\n${files.get(file)}`,
  ).join('');
}
