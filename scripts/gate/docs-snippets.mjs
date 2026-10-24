#!/usr/bin/env node
/** Compile actual public entry-guide examples; no copied fixture can drift from the docs. */
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => readFileSync(join(root,file),'utf8');
const markdown = file => [...read(file).matchAll(/```tsx\n([\s\S]*?)\n```/g)].map(match => match[1]);
function website(file) {
  const source = ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const snippets = [];
  function visit(node) {
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const code = node.text;
      if (/from ['"]@partylayer\//.test(code) || code.includes("from './providers'") || code.startsWith('const walletConnect')) snippets.push(code);
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
  return snippets;
}
const quickStart = markdown('docs/quick-start.md');
const provider = quickStart.find(code => code.includes('export function Providers'));
const app = quickStart.find(code => /export default function/.test(code) && code.includes('ConnectButton') && !code.includes('PartyLayerKit'));
assert.ok(provider && app,'Quick-start provider and application examples must remain independently compilable');
const groups = [
  ['docs/quick-start.md',quickStart],
  ['README.md',markdown('README.md')],
  ['docs/react-cookie-ssr.md',markdown('docs/react-cookie-ssr.md')],
  ['apps/demo/src/app/docs/quick-start/content.tsx',website('apps/demo/src/app/docs/quick-start/content.tsx')],
  ['apps/demo/src/app/content.tsx',website('apps/demo/src/app/content.tsx')],
  ['apps/demo/src/app/docs/rainbowkit-for-canton/content.tsx',website('apps/demo/src/app/docs/rainbowkit-for-canton/content.tsx')],
];
const parent = join(root,'apps/demo/node_modules/.cache');
mkdirSync(parent,{recursive:true});
const temporary = mkdtempSync(join(parent,'partylayer-docs-'));
try {
  const files = [];
  const labels = new Map();
  for (const [source,snippets] of groups) {
    assert.ok(snippets.length,`No examples selected from ${source}; review the extraction contract`);
    for (const [index,snippet] of snippets.entries()) {
      const code = snippet.includes('import ') ? snippet : `import { PartyLayerKit, ConnectButton } from '@partylayer/react';\n${snippet}`;
      const directory = join(temporary,`example-${files.length}`);
      mkdirSync(directory);
      const file = join(directory,'example.tsx');
      writeFileSync(file,code);files.push(file);labels.set(file,`${source} (code block ${index+1})`);
      if (code.includes("from './App'")) writeFileSync(join(directory,'App.tsx'),app);
      if (code.includes("from './providers'")) writeFileSync(join(directory,'providers.tsx'),provider);
    }
  }
  const program = ts.createProgram(files,{
    strict:true,noEmit:true,skipLibCheck:true,jsx:ts.JsxEmit.ReactJSX,
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
    esModuleInterop:true,types:['react','node'],
    typeRoots:[join(root,'apps/demo/node_modules/@types'),join(root,'node_modules/@types')],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    for (const diagnostic of diagnostics) {
      if (diagnostic.file && labels.has(diagnostic.file.fileName)) console.error(`Source: ${labels.get(diagnostic.file.fileName)}`);
      console.error(ts.formatDiagnosticsWithColorAndContext([diagnostic],{getCanonicalFileName:file=>file,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
    }
    process.exitCode = 1;
  } else console.log(`PASS: ${files.length} actual entry-guide, landing and SSR examples compile against public package declarations.`);
} finally {
  rmSync(temporary,{recursive:true,force:true});
}
