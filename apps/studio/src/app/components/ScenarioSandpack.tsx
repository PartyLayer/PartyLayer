'use client';

// Sandpack live-preview for one scenario. S8.3: the code view is now an EDITABLE
// Monaco editor (with PartyLayer IntelliSense) bound to Sandpack's active file;
// edits drive the live preview. The example runs published @partylayer/* via
// Sandpack's bundler and connects to the injected CIP-0103 mock → partyId.
import { SandpackProvider, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react';
import dynamic from 'next/dynamic';
import { connectScenario } from '../scenarios/connectScenario';

// Monaco (~5MB) loaded client-only so it stays out of the SSR/build server bundle.
const ScenarioMonacoEditor = dynamic(() => import('./ScenarioMonacoEditor'), {
  ssr: false,
  loading: () => <div className="scenario-loading">Loading editor…</div>,
});

export function ScenarioSandpack() {
  return (
    <div className="scenario-sandpack">
      <SandpackProvider
        template="react-ts"
        files={connectScenario.files}
        customSetup={{ dependencies: { ...connectScenario.dependencies } }}
        options={{ activeFile: '/App.tsx', recompileMode: 'delayed' }}
      >
        <SandpackLayout>
          {/* Editable Monaco (replaces the read-only SandpackCodeViewer). */}
          <ScenarioMonacoEditor />
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
