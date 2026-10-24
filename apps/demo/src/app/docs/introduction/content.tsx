'use client';

import { useDocs } from '../layout';

export default function IntroductionPage() {
  const { H1, H2, P, Code, CodeBlock, PrevNext, A, UL, LI, Strong } = useDocs();
  return (
    <>
      <H1>The Canton wallet connection kit</H1>
      <P>
        PartyLayer is an open-source TypeScript SDK and React UI for connecting Canton dApps to
        supported wallets. Install the kit once, mount it at your application boundary and render
        the default Connect Wallet button.
      </P>
      <CodeBlock language="bash">{`npm install @partylayer/react @tanstack/react-query`}</CodeBlock>
      <CodeBlock language="tsx">{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

export default function App() {
  return (
    <PartyLayerKit network="devnet" appName="My dApp">
      <ConnectButton />
    </PartyLayerKit>
  );
}`}</CodeBlock>
      <P>
        <A href="/docs/quick-start">Follow the quick start</A> for complete Vite and Next.js setup,
        or <A href="/docs/installation#new-app">generate a new app</A>. The{' '}
        <A href="/docs/installation">installation guide</A> records the target release versions
        and release verification.
      </P>

      <H2 id="features">What comes with the kit</H2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { title: 'Wallets included', desc: 'Reviewed wallet runtimes load as needed. No per-wallet package installation or registration for the default catalog.' },
          { title: 'Branded connection UI', desc: 'Wallet picker, search, connection states, account menu and Powered by PartyLayer attribution by default.' },
          { title: 'CIP-0103 integration', desc: 'Official discovery owns browser-native connections. Accounts, events and provider requests follow the connected wallet.' },
          { title: 'Application controls', desc: 'Choose network, channel, themes and wallet order. Extend the catalog or build a custom UI when needed.' },
          { title: 'Account and operation UI', desc: 'Reactive party/network state, optional backend sign-in, transaction activity and authorized holdings integration.' },
          { title: 'Language and theming', desc: 'English and Turkish UI, explicit RTL, light/dark/auto themes, keyboard navigation and typed React APIs.' },
        ].map(feature => (
          <div key={feature.title} style={{ padding: 20, borderRadius: 10, border: '1px solid rgba(15,23,42,0.10)', background: '#FAFBFC' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0B0F1A', marginBottom: 6 }}>{feature.title}</div>
            <div style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5 }}>{feature.desc}</div>
          </div>
        ))}
      </div>

      <H2 id="wallets">Wallet availability</H2>
      <P>
        The selected network, registry channel and effective capabilities determine the wallet list.
        Vala is Devnet beta; Send is Mainnet-only in the catalog. WalletConnect needs your project
        ID and Bron needs your OAuth/API configuration. Users still log in to or install their wallet.
      </P>
      <P>
        See <A href="/wallets">the wallet directory</A> for integrations and{' '}
        <A href="/docs/wallets">the capability matrix</A> before offering a particular operation.
        A catalog listing is not proof of completed live wallet or ledger acceptance.
      </P>

      <H2 id="application-boundary">What your application supplies</H2>
      <UL>
        <LI><Strong>Authentication:</Strong> a backend challenge and independent signature/key verification for application login.</LI>
        <LI><Strong>Data:</Strong> authorized, party/network-bound ledger reads for holdings and application state.</LI>
        <LI><Strong>Transactions:</Strong> valid Canton/protocol commands and independent verification of final settlement.</LI>
      </UL>
      <P>
        Connecting a wallet or signing a message does not establish a successful transfer or swap.
        Start with <A href="/docs/authentication">authentication</A>,{' '}
        <A href="/docs/transaction-lifecycle">transaction lifecycle</A> and{' '}
        <A href="/docs/wallet-balances">wallet balances</A> when building those features.
      </P>

      <H2 id="packages">Choose your integration</H2>
      <UL>
        <LI><Code>@partylayer/react</Code>: ready-made kit, ConnectButton and React hooks. Includes the SDK and supported wallet runtimes.</LI>
        <LI><Code>@partylayer/sdk</Code>: framework-independent client for custom application stacks.</LI>
        <LI><Code>@partylayer/vue</Code>: Vue composables and Nuxt patterns; custom connection UI.</LI>
        <LI><Code>@partylayer/provider</Code>: advanced provider infrastructure; not a prerequisite for using the kit.</LI>
      </UL>
      <P>
        Coming from Ethereum? <A href="/docs/wagmi-for-canton">The Canton comparison guide</A>{' '}
        explains familiar concepts and where Canton party, ledger and authentication models differ.
      </P>
      <H2 id="ai-reference">Build with an AI coding assistant</H2>
      <P>
        Give your assistant the <A href="/llms-full.txt">plain-text integration reference</A> for
        complete React setup, SDK usage and wallet network requirements, or start with the{' '}
        <A href="/llms.txt">documentation index</A>. These references follow the maintained guides;
        check your installed version and the selected wallet&apos;s capabilities when applying an example.
      </P>
      <PrevNext />
    </>
  );
}
