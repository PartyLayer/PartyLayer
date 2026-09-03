'use client';

import { useDocs } from '../layout';

export default function QuickStartPage() {
  const { H1, H2, P, Code, CodeBlock, Callout, PrevNext, A, OL, UL, LI, Strong, TabGroup } = useDocs();

  return (
    <>
      <H1>Canton dApp quickstart: zero to a working wallet connection</H1>
      <P>
        Get a full wallet connection flow working in your React app in 3 steps.
        By the end of this guide, your users will be able to connect any Canton wallet.
      </P>

      <P>
        <Strong>Coming from Ethereum?</Strong> The connect layer below will feel familiar, and{' '}
        <A href="/docs/wagmi-for-canton">wagmi for Canton</A> maps the hooks you already know onto
        these ones. Read it before you port a read path, because that is the part that does not
        translate.
      </P>

      <H2 id="which-sdk">Which Canton SDK do you need?</H2>
      <P>
        Searching for a Canton Network SDK returns several packages that do different jobs, and
        picking the wrong one costs a day. Here is the honest layout, with each package described by
        what its own publisher says it is.
      </P>

      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid rgba(15,23,42,0.10)' }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>Package</th>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>Use it when</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                '@canton-network/wallet-sdk',
                'You are building a wallet, an exchange or a custody service and need to talk to the ledger directly: allocate parties, authenticate to synchronizers, sign and submit. Published as a Node and browser SDK for integrating with Canton Network. Not what a dApp frontend needs.',
              ],
              [
                '@canton-network/dapp-sdk',
                'You are building a dApp frontend and want the first-party CIP-0103 implementation, published as a browser SDK for dApp development on the Canton Network. It ships its own discovery and wallet-picker component. If you want the reference implementation with no third-party layer, use this.',
              ],
              [
                '@partylayer/react',
                'You are building a dApp frontend in React and want per-wallet quirks handled for you, a registry-backed wallet list, and a themeable connect UI. That is this page. It speaks CIP-0103 too, and adds adapters for wallets that do not.',
              ],
            ].map(([pkg, when]) => (
              <tr key={pkg}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, verticalAlign: 'top', whiteSpace: 'nowrap' }}>{pkg}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Callout type="note">
        <Strong>The honest comparison.</Strong> If your app targets one CIP-0103 native wallet and you
        want the fewest dependencies, the first-party <Code>{'@canton-network/dapp-sdk'}</Code> is the
        shorter path and you should take it. PartyLayer earns its place when you need several wallets
        at once, including ones that are not CIP-0103 native and need an adapter, and when you would
        rather not discover each wallet&apos;s quirks yourself. The{' '}
        <A href="/wallets">wallet directory</A> lists which is which, with the evidence for each.
      </Callout>

      <H2 id="prerequisites">Before you start</H2>
      <UL>
        <LI>
          <Strong>React 18 or 19</Strong> and Node 18 or newer. Every code block below has a
          Next.js and a Vite tab. The code is plain React, so another bundler will work, but those
          two are the ones actually shown.
        </LI>
        <LI>
          <Strong>A wallet to connect to.</Strong> On devnet you do not need one installed to see the
          flow: the modal lists registry wallets and shows install prompts for the ones you lack. To
          complete a real connection you need one of the wallets from the{' '}
          <A href="/wallets">directory</A> that supports your target network.
        </LI>
        <LI>
          <Strong>No ledger credentials, no participant node, no Daml.</Strong> Connecting a wallet
          and reading the connected party needs none of that. You need them when you start submitting
          transactions, which is <A href="/docs/token-transfers">Token transfers</A>.
        </LI>
      </UL>

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

      <H2 id="verify">Verify it actually works</H2>
      <P>
        Three checks, in order. Each one fails differently, so knowing which passed tells you where to
        look.
      </P>
      <OL>
        <LI>
          <Strong>The modal opens and lists wallets.</Strong> If it opens empty, the registry did not
          load. Check the browser console for a registry fetch error; the SDK falls back to
          adapter-only discovery, so an empty list means neither the registry nor any adapter
          produced a wallet.
        </LI>
        <LI>
          <Strong>Selecting a wallet starts its flow.</Strong> An extension wallet prompts, a QR
          wallet opens a window. If nothing happens for a relay wallet, you probably have not wired
          its pairing URI; see the per-wallet notes on the{' '}
          <A href="/wallets">wallet directory</A>.
        </LI>
        <LI>
          <Strong>
            <Code>{'useAccount()'}</Code> reports a party id.
          </Strong>{' '}
          This is the one that matters. A connection that resolves without a party id is not a usable
          session, and the SDK now throws rather than inventing one, so you will see an error rather
          than a silent half-state.
        </LI>
      </OL>

      <H2 id="troubleshooting">If it does not work</H2>
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid rgba(15,23,42,0.10)' }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>Symptom</th>
              <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid rgba(15,23,42,0.10)' }}>Cause and fix</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                'Modal lists no wallets',
                'The registry fetch failed and no adapter was registered. PartyLayerKit registers the built-in set by default; if you passed your own adapters prop you have replaced it, not added to it.',
              ],
              [
                'A wallet is missing from the list',
                'Some adapters need configuration and are skipped without it. Bron needs OAuth config and WalletConnect needs a project id, and both are simply absent when unconfigured rather than shown as broken.',
              ],
              [
                'Hydration mismatch in Next.js',
                'Wallet detection reads window. Render the connect UI on the client. The ConnectButton handles this; a custom picker built on useWallets has to.',
              ],
              [
                'useSignMessage rejects on some wallets',
                'Not every adapter implements it. Three registry wallets declare signMessage: false, so an app that gates login on a signed message has no path through them. Check the capability matrix before offering a wallet.',
              ],
              [
                'Signature does not verify against my backend',
                'Console Wallet base64-encodes the message bytes before signing. If your backend verifies raw bytes the signatures will not match.',
              ],
            ].map(([sym, fix]) => (
              <tr key={sym}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)', verticalAlign: 'top', fontWeight: 600 }}>{sym}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>{fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
