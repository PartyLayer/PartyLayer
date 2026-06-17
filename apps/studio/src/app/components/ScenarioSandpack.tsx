'use client';

// Sandpack live-preview. S8.3: editable Monaco editor (PartyLayer IntelliSense)
// bound to the active file; edits drive the live preview. S8.4: a mock-driver
// panel rewrites /studio-mock-config.ts (via sandpack.updateFile → recompile) so
// the preview can demonstrate connect SUCCESS and FAILURE paths. The example runs
// published @partylayer/* via Sandpack's bundler against the injected mock.
import { SandpackProvider, SandpackLayout, SandpackPreview, useSandpack } from '@codesandbox/sandpack-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  connectScenario,
  DEFAULT_MOCK_CONFIG,
  mockConfigFile,
  type MockDriverConfig,
} from '../scenarios/connectScenario';
import { MockDriverPanel } from './MockDriverPanel';

// Monaco (~5MB) loaded client-only so it stays out of the SSR/build server bundle.
const ScenarioMonacoEditor = dynamic(() => import('./ScenarioMonacoEditor'), {
  ssr: false,
  loading: () => <div className="scenario-loading">Loading editor…</div>,
});

// Inside SandpackProvider so useSandpack() has context. On a driver change it
// rewrites the hidden /studio-mock-config.ts → Sandpack recompiles → the entry
// re-applies the config to the mock's connect.
function DriverControls() {
  const { sandpack } = useSandpack();
  const [config, setConfig] = useState<MockDriverConfig>(DEFAULT_MOCK_CONFIG);
  return (
    <MockDriverPanel
      config={config}
      onChange={(next) => {
        setConfig(next);
        sandpack.updateFile('/studio-mock-config.ts', mockConfigFile(next));
      }}
    />
  );
}

export function ScenarioSandpack() {
  return (
    <div className="scenario-sandpack">
      <SandpackProvider
        template="react-ts"
        files={connectScenario.files}
        customSetup={{ dependencies: { ...connectScenario.dependencies } }}
        options={{ activeFile: '/App.tsx', recompileMode: 'delayed' }}
      >
        <DriverControls />
        <SandpackLayout>
          {/* Editable Monaco (replaces the read-only SandpackCodeViewer). */}
          <ScenarioMonacoEditor />
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
