'use client';

// Sandpack live-preview for one scenario (S8.2): read-only code view + live
// preview. NO Monaco editing yet (that's S8.3). The example runs published
// @partylayer/* via Sandpack's (remote) bundler and connects to the inlined
// CIP-0103 mock wallet → the partyId renders in the preview.
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackCodeViewer,
} from '@codesandbox/sandpack-react';
import { connectScenario } from '../scenarios/connectScenario';

export function ScenarioSandpack() {
  return (
    <div className="scenario-sandpack">
      <SandpackProvider
        template="react-ts"
        files={connectScenario.files}
        customSetup={{ dependencies: { ...connectScenario.dependencies } }}
        // enableServiceWorker → Sandpack serves /public static files (the empty
        // registry JSON) so the SDK's registry fetch gets valid JSON, not the
        // HTML SPA-fallback that caused the connect-time JSON-parse TransportError.
        options={{ activeFile: '/App.tsx', recompileMode: 'delayed', experimental_enableServiceWorker: true }}
      >
        <SandpackLayout>
          {/* Read-only code view (S8.3 swaps Monaco in for editing). */}
          <SandpackCodeViewer />
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
