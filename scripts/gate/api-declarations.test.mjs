import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { declarationCanonical } from './api-declarations.mjs';
import { astCanonical } from './api-normalize.mjs';

function fixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'pl-api-closure-'));
  const write = (file, text) => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  try {
    for (const [file, text] of Object.entries(files)) write(file, text);
    return run(join(root, 'index.d.ts'), write);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('an unchunked entry retains the existing canonical byte for byte; external packages stay external', () => {
  const entry = "import type { Other } from '@missing/other'; export { External } from 'external-package'; export type Result = import('another-missing-package').Result; export interface Client { other: Other; }";
  fixture({ 'index.d.ts': entry }, path => assert.equal(declarationCanonical(path), astCanonical(entry)));
});

test('a shared declaration API change drifts even when its filename and root text do not change', () => {
  fixture({
    'index.d.ts': "export { Client } from './shared-stable.js';",
    'shared-stable.d.ts': 'export declare class Client { connect(name: string): Promise<void>; }',
  }, (path, write) => {
    const before = declarationCanonical(path);
    write('shared-stable.d.ts', 'export declare class Client { connect(name: number): Promise<void>; }');
    const after = declarationCanonical(path);
    assert.notEqual(before, after);
    assert.match(after, /connect\(name: number\)/);
  });
});

test('cycles and repeated imports include each local declaration file only once', () => {
  fixture({
    'index.d.ts': "export { A } from './a.js'; export { A as Again } from './a.js'; export { B } from './b.js';",
    'a.d.ts': "import type { B } from './b.js'; export interface A { value: B; }",
    'b.d.ts': "import type { A } from './a.js'; export interface B { value: A; } export { A } from './a.js';",
  }, path => {
    const canonical = declarationCanonical(path);
    assert.equal(canonical.match(/export interface A \{/g)?.length, 1);
    assert.equal(canonical.match(/export interface B \{/g)?.length, 1);
  });
});

test('closure contents remain immune to formatting, comments, and top-level declaration ordering', () => {
  fixture({
    'index.d.ts': "export { A } from './a.js'; export { B } from './b.js';",
    'a.d.ts': 'export interface A { value: string; } export type Identifier = string;',
    'b.d.ts': 'export interface B { value: number; }',
  }, (path, write) => {
    const before = declarationCanonical(path);
    write('index.d.ts', "// reordered\nexport { B } from './b.js';\nexport { A } from './a.js';");
    write('a.d.ts', '/** comment */ export type Identifier = string;\nexport interface A {\n value:   string; // note\n}');
    assert.equal(declarationCanonical(path), before);
  });
});

test('local type imports, import() types, and import-equals references join the public declaration closure', () => {
  fixture({
    'index.d.ts': "import type { Model } from './model.js'; import Legacy = require('./legacy.cjs'); export interface Client { model: Model; current: import('./current.mjs').Current; legacy: Legacy.Value; }",
    'model.d.ts': 'export interface Model { id: string; }',
    'legacy.d.cts': 'export interface Value { legacy: true; }',
    'current.d.mts': 'export interface Current { current: true; }',
  }, path => {
    const canonical = declarationCanonical(path);
    for (const name of ['Model', 'Value', 'Current']) assert.match(canonical, new RegExp(`export interface ${name} \\{`));
  });
});

test('relative reference paths, direct declarations, and extensionless directory declarations resolve', () => {
  fixture({
    'index.d.ts': '/// <reference path="references.d.ts" />\nexport { Explicit } from "./explicit.d.ts"; export { Directory } from "./directory";',
    'references.d.ts': 'declare interface Referenced { referenced: true; }',
    'explicit.d.ts': 'export interface Explicit { explicit: true; }',
    'directory/index.d.ts': 'export interface Directory { directory: true; }',
  }, path => {
    const canonical = declarationCanonical(path);
    for (const name of ['Referenced', 'Explicit', 'Directory']) assert.match(canonical, new RegExp(`interface ${name} \\{`));
  });
});

test('local module specifiers keep their actual published names', () => {
  fixture({
    'index.d.ts': "export { Model } from './model-first.js';",
    'model-first.d.ts': 'export interface Model { id: string; }',
  }, (path, write) => {
    const before = declarationCanonical(path);
    write('index.d.ts', "export { Model } from './model-second.js';");
    write('model-second.d.ts', 'export interface Model { id: string; }');
    const after = declarationCanonical(path);
    assert.notEqual(before, after);
    assert.ok(after.includes('./model-second.js'));
    assert.ok(!after.includes('./model-first.js'));
  });
});

test('missing local declarations fail instead of silently accepting a runtime JavaScript file', () => {
  fixture({
    'index.d.ts': "export { Missing } from './missing.js';",
    'missing.js': 'export const Missing = 1;',
  }, path => assert.throws(() => declarationCanonical(path), /missing\.js.*index\.d\.ts/));
});

test('missing relative triple-slash references fail too', () => {
  fixture({ 'index.d.ts': '/// <reference path="absent.d.ts" />\nexport interface Client {}' },
    path => assert.throws(() => declarationCanonical(path), /absent\.d\.ts.*index\.d\.ts/));
});
