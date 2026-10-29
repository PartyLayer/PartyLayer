'use client';

import { useDocs } from '../layout';

export default function InstallationPage() {
  const { H1, H2, H3, P, Code, CodeBlock, TabGroup, Callout, PrevNext, A, UL, LI, Strong } = useDocs();
  return (
    <>
      <H1>Installation</H1>
      <P>Install once to get the React connection kit, SDK and supported wallet runtimes. Choose an existing app integration or generate a new project.</P>
      <Callout type="note" title="Version scope">
        This guide requires React 3.1.0+ / SDK 0.20.0+ and CLI 0.6.0+ for the listed templates.
        See <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/releasing.md#default-wallet-release-validation">release validation</A>{' '}
        for publication and acceptance evidence.
      </Callout>

      <H2 id="framework-support">Choose your framework</H2>
      <P>The connection protocol is shared; the UI and runtime requirements depend on your application stack.</P>
      <div role="region" aria-label="Framework support table; scroll horizontally if needed" tabIndex={0} style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', textAlign: 'left', fontSize: 14, lineHeight: 1.5, color: '#334155' }}>
          <caption style={{ textAlign: 'left', marginBottom: 12 }}>PartyLayer framework and UI support. Scroll horizontally on smaller screens.</caption>
          <thead><tr>{['Application', 'Integration', 'Connection UI and requirements'].map(label => <th key={label} scope="col" style={{ padding: 12, borderBottom: '1px solid #CBD5E1' }}>{label}</th>)}</tr></thead>
          <tbody>
            {[
              ['React / Vite', '@partylayer/react', 'PartyLayerKit and ConnectButton; browser wallet access.'],
              ['Next.js App Router', '@partylayer/react', 'Same kit in a client boundary. SSR cookies restore UI hints; verify authentication on your backend.'],
              ['Vue / Nuxt', '@partylayer/vue', 'Composables and application-owned connection UI. Start with the vue-nuxt-pinia template.'],
              ['Other web frameworks', '@partylayer/sdk', 'Framework-independent client; your app supplies the picker and lifecycle.'],
              ['React Native', '@partylayer/react-native', 'Separate native UI entrypoint and storage setup. Browser extension discovery does not establish mobile-wallet compatibility.'],
            ].map(([stack, integration, details]) => <tr key={stack}><th scope="row" style={{ padding: 12, borderBottom: '1px solid #E2E8F0' }}>{stack}</th><td style={{ padding: 12, borderBottom: '1px solid #E2E8F0' }}><Code>{integration}</Code></td><td style={{ padding: 12, borderBottom: '1px solid #E2E8F0' }}>{details}</td></tr>)}
          </tbody>
        </table>
      </div>
      <P>For native setup and peer dependencies, use the <A href="https://github.com/PartyLayer/PartyLayer/tree/main/packages/react-native">React Native guide</A>. Validate each wallet&apos;s transport on the target platform; package availability alone is not live acceptance.</P>

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
      <H3>Recover a dependency installation failure</H3>
      <P>If your package manager reports an installation error, keep the generated project, resolve the reported registry, network or dependency issue, then retry the install before starting the development server:</P>
      <CodeBlock language="bash">{`cd my-dapp
npm install
npm run dev`}</CodeBlock>
      <P>Use the package manager you selected. With <Code>--no-install</Code>, these installation steps are intentionally left to you.</P>

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

      <H2 id="troubleshooting">Common setup questions</H2>
      <P>Upgrading an existing integration? Follow the <A href="/docs/migration">migration guide</A>. For a coding assistant, use the <A href="/docs/ai-integration">AI integration guide</A> and maintained plain-text reference.</P>
      <Callout type="note">CLI 0.7.0 requires Node 20.12.0+ and adds read-only --doctor diagnostics for installed package, peer and Node compatibility. Until that release is published, use the current CLI for scaffolding and follow the <A href="https://github.com/PartyLayer/PartyLayer/tree/main/packages/create-partylayer-app#diagnose-an-existing-application">release and diagnostic usage notes</A> before invoking the new flag.</Callout>
      <H3>Why is a wallet missing from Connect Wallet?</H3>
      <P>Check the configured network and registry channel first. Send requires Mainnet; Vala requires Devnet beta. Then check required application configuration for WalletConnect or Bron and whether the wallet is installed or logged in. See the <A href="/docs/wallets">wallet support matrix</A> and <A href="/docs/error-handling">error-handling guide</A>.</P>
      <H3>Does signing a message prove that transfers and swaps work?</H3>
      <P>A message signature verifies only that signing operation. Transfers and swaps also require supported capabilities, valid protocol commands, authorization, funding and confirmed ledger outcomes. Follow <A href="/docs/transaction-lifecycle">the transaction lifecycle</A> before showing a successful payment or swap.</P>
      <H3>How should an AI coding assistant use these docs?</H3>
      <P>Provide <A href="/llms-full.txt">the maintained integration reference</A>, your installed package versions and your target network. Ask it to follow <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/protocol-ownership.md">protocol ownership</A> when migrating an existing app. Compile and run the resulting integration, then verify connection and ledger operations separately.</P>
      <PrevNext />
    </>
  );
}
