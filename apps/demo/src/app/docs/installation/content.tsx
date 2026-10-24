'use client';

import { useDocs } from '../layout';

export default function InstallationPage() {
  const { H1, H2, H3, P, Code, CodeBlock, TabGroup, Callout, PrevNext, A, UL, LI, Strong } = useDocs();
  return (
    <>
      <H1>Installation</H1>
      <P>Install once to get the React connection kit, SDK and supported wallet runtimes. Choose an existing app integration or generate a new project.</P>
      <Callout type="note" title="Version scope">
        This guide targets React 3.1.0 / SDK 0.20.0 and CLI 0.6.0. These are release candidates;
        npm <Code>@latest</Code> remains the previous release until publication. Check the{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/pull/343">release status</A> before relying on candidate features.
      </Callout>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI><Strong>React 18+</Strong> for the connection kit.</LI>
        <LI><Strong>Node.js:</Strong> package minimum 18; use a supported LTS version that also meets your framework requirements.</LI>
        <LI><Strong>Wallet access:</Strong> a supported account/extension on your target network for an actual connection.</LI>
      </UL>

      <H2 id="install-packages">Existing React application</H2>
      <TabGroup tabs={[
        { label: 'npm', content: 'npm install @partylayer/react @tanstack/react-query', language: 'bash' },
        { label: 'pnpm', content: 'pnpm add @partylayer/react @tanstack/react-query', language: 'bash' },
        { label: 'yarn', content: 'yarn add @partylayer/react @tanstack/react-query', language: 'bash' },
      ]} />
      <CodeBlock language="tsx">{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export default function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <ConnectButton />
    </PartyLayerKit>
  );
}`}</CodeBlock>
      <P>
        No separate SDK, core or wallet installation is needed. No stylesheet import is required.
        In Next.js, mount the kit in a client provider boundary; the{' '}
        <A href="/docs/quick-start#step-2">quick start</A> includes the root layout.
      </P>
      <Callout type="note" title="TanStack Query">
        TanStack Query is a required peer. The base connection UI works without its provider.
        Add <Code>QueryClientProvider</Code> when using <Code>@partylayer/react/query</Code> data hooks;
        your app owns that client and the authorized data sources.
      </Callout>

      <H2 id="new-app">Create a new app</H2>
      <CodeBlock language="bash">{`npm create partylayer-app@latest my-dapp -- --template react-vite --pm npm
cd my-dapp
npm run dev`}</CodeBlock>
      <P>
        The CLI creates the project and installs dependencies. Use <Code>next-ssr</Code> for Next.js.
        Vue/Nuxt, vanilla TypeScript and two demo vertical templates are also available; see the{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/tree/main/packages/create-partylayer-app">CLI guide</A>.
      </P>

      <H2 id="wallet-setup">Wallet setup</H2>
      <UL>
        <LI>Default runtimes are included and load as needed. Network and registry channel filter the catalog.</LI>
        <LI><Strong>Vala:</Strong> Devnet with <Code>channel="beta"</Code>.</LI>
        <LI><Strong>Send:</Strong> Mainnet-only in the catalog.</LI>
        <LI><Strong>WalletConnect:</Strong> your project ID through <Code>walletConnect</Code>.</LI>
        <LI><Strong>Bron:</Strong> your OAuth/API configuration through <Code>bron</Code>.</LI>
        <LI>Use <Code>additionalAdapters</Code> to extend the catalog; <Code>adapters</Code> replaces it.</LI>
      </UL>
      <P>Accounts, wallet login, approval and test funding remain separate prerequisites. See <A href="/docs/partylayer-kit">kit configuration</A> for complete options.</P>

      <H2 id="vanilla-js">Other application stacks</H2>
      <H3>Framework-independent TypeScript</H3>
      <TabGroup tabs={[
        { label: 'npm', content: 'npm install @partylayer/sdk', language: 'bash' },
        { label: 'pnpm', content: 'pnpm add @partylayer/sdk', language: 'bash' },
        { label: 'yarn', content: 'yarn add @partylayer/sdk', language: 'bash' },
      ]} />
      <P>Build your own interface and manage the client lifecycle with the <A href="/docs/vanilla-js">SDK</A>. The React ConnectButton is available from the React kit.</P>
      <H3>Provider infrastructure</H3>
      <P>
        The client already exposes <Code>asProvider()</Code>. You do not need a separate provider
        package to use the default kit. Advanced provider implementors can use{' '}
        <Code>@partylayer/provider</Code>; see <A href="/docs/generic-bridge">the provider integration guide</A>.
      </P>

      <H2 id="verify">Verify installation</H2>
      <P>Run your app, open Connect Wallet, select a supported wallet and complete approval. Confirm the connected party and actual network with <Code>useAccount()</Code>. An import resolving proves installation only; connection and ledger outcomes require their own checks.</P>
      <P>Continue with the <A href="/docs/quick-start">quick start</A>, then <A href="/docs/authentication">authentication</A> or <A href="/docs/transaction-lifecycle">transactions</A>.</P>
      <PrevNext />
    </>
  );
}
