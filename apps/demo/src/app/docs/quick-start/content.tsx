'use client';

import { useDocs } from '../layout';

export default function QuickStartPage() {
  const { H1, H2, P, Code, CodeBlock, Callout, PrevNext, A, OL, UL, LI, Strong, TabGroup } = useDocs();

  return (
    <>
      <H1>Quick start</H1>
      <P>
        Add the PartyLayer wallet picker and account menu to your React app. One installation
        includes the SDK and reviewed wallet runtimes. No wallet-specific imports or stylesheet
        import are required.
      </P>
      <Callout type="note" title="Version scope">
        This guide requires React 3.1.0+ / SDK 0.20.0+. See{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/releasing.md#default-wallet-release-validation">release validation</A>{' '}
        for publication and acceptance evidence.
      </Callout>
      <P>
        Use React 18+ and a supported Node LTS version that meets your framework requirements.
        To complete a real connection, users need a wallet account or extension on your selected network.
      </P>

      <H2 id="new-app">Start a new app</H2>
      <P>The CLI creates your project and installs its dependencies:</P>
      <CodeBlock language="bash">{`npm create partylayer-app@latest my-dapp -- --template react-vite --pm npm
cd my-dapp
npm run dev`}</CodeBlock>
      <P>
        Use <Code>--template next-ssr</Code> for Next.js App Router. The{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/tree/main/packages/create-partylayer-app">CLI guide</A>{' '}
        lists all six templates. Generated React apps already use the PartyLayer button and attribution.
        For an existing app, follow the steps below.
      </P>

      <H2 id="step-1">Step 1: Install</H2>
      <TabGroup tabs={[
        { label: 'npm', content: 'npm install @partylayer/react @tanstack/react-query', language: 'bash' },
        { label: 'pnpm', content: 'pnpm add @partylayer/react @tanstack/react-query', language: 'bash' },
        { label: 'yarn', content: 'yarn add @partylayer/react @tanstack/react-query', language: 'bash' },
      ]} />
      <P>
        You do not need a separate SDK, core or wallet package installation. TanStack Query is a
        required peer. Its <Code>QueryClientProvider</Code> is needed for optional{' '}
        <Code>@partylayer/react/query</Code> data hooks; the base connect UI works without that provider.
      </P>

      <H2 id="step-2">Step 2: Mount the kit</H2>
      <TabGroup tabs={[
        { label: 'Vite + React', language: 'tsx', content: `// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PartyLayerKit } from '@partylayer/react';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PartyLayerKit network="devnet" appName="My dApp">
      <App />
    </PartyLayerKit>
  </StrictMode>,
);` },
        { label: 'Next.js', language: 'tsx', content: `// app/providers.tsx
'use client';

import type { ReactNode } from 'react';
import { PartyLayerKit } from '@partylayer/react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      {children}
    </PartyLayerKit>
  );
}` },
      ]} />
      <P>In Next.js, mount the provider in your server-rendered root layout:</P>
      <CodeBlock language="tsx">{`// app/layout.tsx — keep this a Server Component
import type { ReactNode } from 'react';
import { Providers } from './providers';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}`}</CodeBlock>
      <P>
        Use one kit at your application boundary. It owns discovery, client cleanup, theme and
        session context. Keep <Code>walletConnect</Code>, <Code>bron</Code> and{' '}
        <Code>additionalAdapters</Code> objects stable outside render or with <Code>useMemo</Code>;
        changes recreate the client.
      </P>

      <H2 id="step-3">Step 3: Add ConnectButton</H2>
      <P>Use <Code>src/App.tsx</Code> in Vite or <Code>app/page.tsx</Code> in Next.js:</P>
      <CodeBlock language="tsx">{`'use client';

import { ConnectButton } from '@partylayer/react';

export default function Home() {
  return (
    <main>
      <h1>My Canton dApp</h1>
      <ConnectButton />
    </main>
  );
}`}</CodeBlock>
      <P>
        Users choose a wallet and approve its connection. The connected button opens the account
        menu. The modal shows <Strong>Powered by PartyLayer</Strong> by default. Hosted login and
        extension installation remain wallet prerequisites.
      </P>

      <H2 id="using-hooks">Read the connected account</H2>
      <CodeBlock language="tsx">{`import { useAccount } from '@partylayer/react';

export function Account() {
  const { isConnected, status, party, networkId } = useAccount();
  if (!isConnected) return <p>Wallet: {status}</p>;
  return <p>{party} · {networkId}</p>;
}`}</CodeBlock>
      <P>
        Render this inside the kit. A wallet session is not application authentication; use the{' '}
        <A href="/docs/authentication">authentication guide</A> for server-verified sign-in.
        For optional data hooks, wrap the kit in <Code>QueryClientProvider</Code>. In a Next.js client
        provider, create its stable client with <Code>useState(() =&gt; new QueryClient())</Code> rather
        than sharing it across server requests. See <A href="/docs/hooks#query-hooks">data hooks</A>.
      </P>

      <H2 id="wallet-config">Configure wallets</H2>
      <UL>
        <LI><Strong>Network:</Strong> set <Code>network</Code> to <Code>devnet</Code>, <Code>testnet</Code> or <Code>mainnet</Code>. The catalog follows network support.</LI>
        <LI><Strong>Vala:</Strong> set <Code>network="devnet" channel="beta"</Code>.</LI>
        <LI><Strong>Send:</Strong> Mainnet-only in the catalog; it is absent on Devnet.</LI>
        <LI><Strong>WalletConnect:</Strong> supply your own project ID through <Code>walletConnect</Code>.</LI>
        <LI><Strong>Bron:</Strong> supply your OAuth/API configuration through <Code>bron</Code>.</LI>
        <LI><Strong>Custom integrations:</Strong> <Code>additionalAdapters</Code> extends the catalog; <Code>adapters</Code> replaces it.</LI>
        <LI><Strong>Appearance:</Strong> use <Code>theme="auto" locale="en"</Code>; Turkish and explicit RTL are also supported.</LI>
      </UL>
      <CodeBlock language="tsx">{`const walletConnect = { projectId: 'YOUR_PROJECT_ID' };

<PartyLayerKit network="devnet" appName="My dApp" walletConnect={walletConnect}>
  <ConnectButton />
</PartyLayerKit>`}</CodeBlock>
      <P>
        Runtimes ship with the kit and load as needed. A listing or capability declaration is not
        proof of completed live testing. See <A href="/docs/wallets">wallet capabilities</A> and the{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/wallet-acceptance.md">acceptance evidence</A>.
      </P>

      <H2 id="verify">Verify the connection</H2>
      <OL>
        <LI>Open Connect Wallet and check the list against your network and channel.</LI>
        <LI>Select a wallet from the button flow; complete login, installation and approval if needed.</LI>
        <LI>Confirm <Code>useAccount()</Code> reports the party and actual wallet network.</LI>
        <LI>Disconnect and confirm the account clears. Test reload/restoration separately; a cached hint alone is not a live connection.</LI>
      </OL>
      <Callout type="note">
        Connection or message signing does not verify a transfer or swap. Those need valid
        commands, test balance and independent ledger confirmation. See{' '}
        <A href="/docs/transaction-lifecycle">transaction lifecycle</A>.
      </Callout>

      <H2 id="troubleshooting">Troubleshooting</H2>
      <UL>
        <LI><Strong>Missing wallet:</Strong> check network/channel, WalletConnect/Bron settings and whether <Code>adapters</Code> replaced defaults.</LI>
        <LI><Strong>Empty picker:</Strong> check registry/discovery errors, filters and custom adapter configuration.</LI>
        <LI><Strong>Popup blocked:</Strong> start from a user click; use the default button to preserve the supported popup flow.</LI>
        <LI><Strong>Signing rejected:</Strong> check session capabilities, actual network and wallet authentication. Inspect the vendor error.</LI>
        <LI><Strong>Signature verification failed:</Strong> verify exact challenge bytes/encoding, nonce, origin and independently authorized key. There is no universal vendor algorithm.</LI>
        <LI><Strong>Old native session:</Strong> caches without an official provider hint need one reconnect. Live party/network checks still apply.</LI>
        <LI><Strong>Next.js hydration:</Strong> keep the kit in a client boundary. SSR cookie state is a UI hint; protect server content with backend authentication.</LI>
      </UL>

      <H2 id="next-steps">Next steps</H2>
      <UL>
        <LI><A href="/docs/partylayer-kit">Kit configuration</A> and <A href="/docs/connect-button">ConnectButton</A>.</LI>
        <LI><A href="/docs/authentication">Authentication</A>, <A href="/docs/transaction-lifecycle">transaction lifecycle</A> and <A href="/docs/wallet-balances">wallet balances</A>.</LI>
        <LI><A href="/docs/token-transfers">Token transfers</A> and their wallet-specific command requirements.</LI>
        <LI><A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/protocol-ownership.md">Protocol ownership and migration</A> for existing apps.</LI>
        <LI><A href="/docs/vanilla-js">Framework-independent SDK</A> for a custom application stack.</LI>
      </UL>
      <PrevNext />
    </>
  );
}
