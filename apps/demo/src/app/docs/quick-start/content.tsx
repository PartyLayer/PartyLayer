'use client';

import { useDocs } from '../layout';

export default function QuickStartPage() {
  const { H1, H2, P, Code, CodeBlock, Callout, PrevNext, A, OL, LI, Strong, TabGroup } = useDocs();

  return (
    <>
      <H1>Quick Start</H1>
      <P>
        Get a full wallet connection flow working in your React app in 3 steps.
        By the end of this guide, your users will be able to connect any Canton wallet.
      </P>

      <H2 id="step-1">Step 1: Install</H2>
      <P>
        Add the PartyLayer packages to your existing React project. If you{"'"}re starting fresh with
        Vite, run <Code>{'npm create vite@latest my-dapp -- --template react-ts'}</Code> first.
      </P>
      <CodeBlock language="bash">{`npm install @partylayer/sdk @partylayer/react @tanstack/react-query`}</CodeBlock>

      <H2 id="step-2">Step 2: Wrap Your App</H2>
      <P>
        Add <Code>{'PartyLayerKit'}</Code> at the root of your component tree.
        It handles wallet discovery, session management, and theming automatically.
      </P>
      <TabGroup tabs={[
        {
          label: 'Vite + React',
          language: 'tsx',
          content: `// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit } from '@partylayer/react';
import App from './App';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="mainnet" appName="My dApp">
        <App />
      </PartyLayerKit>
    </QueryClientProvider>
  </StrictMode>,
);`,
        },
        {
          label: 'Next.js',
          language: 'tsx',
          content: `// app/providers.tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit } from '@partylayer/react';

export function Providers({ children }: { children: React.ReactNode }) {
  // useState gives each client one stable QueryClient (never shared across requests).
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="mainnet" appName="My dApp">
        {children}
      </PartyLayerKit>
    </QueryClientProvider>
  );
}`,
        },
      ]} />

      <Callout type="tip">
        <Code>{'PartyLayerKit'}</Code> automatically registers all built-in wallet adapters
        (Console, Loop, Cantor8, Nightly), fetches the wallet registry, and sets up session persistence.
        Send is discovered through the CIP-0103 announce path, so it appears in the picker without being registered.
      </Callout>

      <Callout type="note" title="Why QueryClientProvider">
        v2{"'"}s data hooks (the <Code>{'@partylayer/react/query'}</Code> entrypoint) are built on
        TanStack Query, so they need a <Code>{'QueryClient'}</Code> in context. The base connect flow
        below (<Code>{'PartyLayerKit'}</Code>, <Code>{'ConnectButton'}</Code>, <Code>{'useAccount'}</Code>)
        works without it, but wrapping in <Code>{'QueryClientProvider'}</Code> now means the data hooks
        are ready when you reach for them. See the <A href="/docs/hooks">Hooks</A> reference.
      </Callout>

      <H2 id="step-3">Step 3: Add ConnectButton</H2>
      <P>
        Drop <Code>{'ConnectButton'}</Code> anywhere in your app. It renders a connect button when
        disconnected and shows the connected address with a disconnect dropdown when connected.
      </P>
      <TabGroup tabs={[
        {
          label: 'Vite + React',
          language: 'tsx',
          content: `// src/App.tsx
import { ConnectButton } from '@partylayer/react';

export default function App() {
  return (
    <div>
      <h1>My Canton dApp</h1>
      <ConnectButton />
    </div>
  );
}`,
        },
        {
          label: 'Next.js',
          language: 'tsx',
          content: `// app/page.tsx
import { ConnectButton } from '@partylayer/react';

export default function Home() {
  return (
    <div>
      <h1>My Canton dApp</h1>
      <ConnectButton />
    </div>
  );
}`,
        },
      ]} />

      <P>
        That{"'"}s it! Your app now has a complete wallet connection flow with a polished modal,
        wallet auto-discovery, and session management.
      </P>

      <H2 id="complete-example">Complete Example</H2>
      <P>Here{"'"}s the full setup in a single file:</P>
      <TabGroup tabs={[
        {
          label: 'Vite + React',
          language: 'tsx',
          content: `// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

const queryClient = new QueryClient();

function App() {
  return (
    <>
      <nav>
        <h1>My dApp</h1>
        <ConnectButton />
      </nav>
      <main>
        <p>Your app content here</p>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="mainnet" appName="My dApp">
        <App />
      </PartyLayerKit>
    </QueryClientProvider>
  </StrictMode>,
);`,
        },
        {
          label: 'Next.js',
          language: 'tsx',
          content: `// app/providers.tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="mainnet" appName="My dApp">
        <nav>
          <h1>My dApp</h1>
          <ConnectButton />
        </nav>
        {children}
      </PartyLayerKit>
    </QueryClientProvider>
  );
}`,
        },
      ]} />

      <H2 id="whats-happening">What{"'"}s Happening Under the Hood?</H2>
      <P>When <Code>{'PartyLayerKit'}</Code> mounts, it:</P>
      <OL>
        <LI><Strong>Creates a PartyLayerClient</Strong>: the core SDK instance that manages all wallet operations</LI>
        <LI><Strong>Registers built-in adapters</Strong>: Console, Loop, Cantor8, and Nightly wallet adapters (Send is served through the CIP-0103 announce path)</LI>
        <LI><Strong>Fetches the wallet registry</Strong>: verified wallet metadata from <Code>{'registry.partylayer.xyz'}</Code></LI>
        <LI><Strong>Groups CIP-0103 native wallets</Strong>: those flagged <Code>{'cip0103.native: true'}</Code> in the registry render in a dedicated picker section</LI>
        <LI><Strong>Restores existing sessions</Strong>: if a user was previously connected, the session is restored automatically</LI>
      </OL>

      <H2 id="using-hooks">Using Session Data</H2>
      <P>
        Once connected, read the session reactively from any component with <Code>{'useAccount'}</Code>:
      </P>
      <CodeBlock language="tsx">{`import { useAccount } from '@partylayer/react';

function Profile() {
  const { isConnected, status, party, networkId } = useAccount();

  if (!isConnected) return <p>Not connected ({status})</p>;

  return (
    <div>
      <p>Party ID: {party}</p>
      <p>Network: {networkId}</p>
    </div>
  );
}`}</CodeBlock>

      <H2 id="next-steps">Next Steps</H2>
      <P>Now that you have basic connectivity, explore more:</P>
      <OL>
        <LI><A href="/docs/partylayer-kit">PartyLayerKit</A>: Configuration options (network, adapters, theme)</LI>
        <LI><A href="/docs/connect-button">ConnectButton</A>: Customize the button appearance and behavior</LI>
        <LI><A href="/docs/hooks">React Hooks</A>: Use <Code>{'useSignMessage'}</Code>, <Code>{'useSubmitTransaction'}</Code>, and the <Code>{'/query'}</Code> data hooks (<Code>{'useDamlContract'}</Code>, <Code>{'useChoice'}</Code>, cost hooks)</LI>
        <LI><A href="/docs/cookbook">Pattern Cookbook</A>: Copy-paste recipes for the data hooks, optimistic updates, and Suspense</LI>
        <LI><A href="/docs/theming">Theming</A>: Switch between light, dark, and custom themes</LI>
        <LI><A href="/docs/wallets">Wallets & Adapters</A>: Add custom wallet adapters or the Bron enterprise wallet</LI>
      </OL>

      <PrevNext />
    </>
  );
}
