'use client';

// Editable Monaco editor bound to Sandpack's active file (Sandpack's own editor
// is CodeMirror — no real TS IntelliSense). We feed Monaco the curated PartyLayer
// .d.ts as an extraLib so typing shows autocomplete + hover for createPartyLayer /
// useWallets / useConnect / PartyLayerProvider. Default-exported for the lazy
// ssr:false dynamic import in ScenarioSandpack (keeps ~5MB monaco out of SSR).
import Editor, { type BeforeMount } from '@monaco-editor/react';
import { useActiveCode, useSandpack } from '@codesandbox/sandpack-react';
import { PARTYLAYER_DTS } from './partylayer-types';

const beforeMount: BeforeMount = (monaco) => {
  const ts = monaco.languages.typescript.typescriptDefaults;
  ts.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.React,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    esModuleInterop: true,
  });
  // STEP-1 goal is PartyLayer autocomplete + hover. Suppress semantic squiggles
  // (we deliberately don't bundle @types/react/dom here), but keep syntax errors.
  // Completions + hover come from the language service regardless of this flag.
  ts.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  ts.addExtraLib(PARTYLAYER_DTS, 'file:///node_modules/@types/partylayer/index.d.ts');
};

export default function ScenarioMonacoEditor() {
  const { code, updateCode } = useActiveCode();
  const { sandpack } = useSandpack();

  return (
    <Editor
      // Re-key + path on the active file so the model is .tsx (JSX parsed) and
      // resets when the scenario's active file changes.
      key={sandpack.activeFile}
      path={sandpack.activeFile}
      theme="vs-dark"
      height="520px"
      value={code}
      onChange={(value) => updateCode(value || '')}
      beforeMount={beforeMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        readOnly: false,
        tabSize: 2,
      }}
    />
  );
}
