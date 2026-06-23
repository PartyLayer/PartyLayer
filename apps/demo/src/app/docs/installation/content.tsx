'use client';

import { useDocs } from '../layout';

export default function InstallationPage() {
  const { H1, H2, H3, P, Code, CodeBlock, TabGroup, Callout, PrevNext, A, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>Installation</H1>
      <P>
        Get up and running with PartyLayer in your project. The SDK supports React 18+ and Node.js 18+.
      </P>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI><Strong>Node.js</Strong> 18 or later</LI>
        <LI><Strong>React</Strong> 18 or later (for React integration)</LI>
        <LI>A <Strong>Canton Network</Strong> dApp — PartyLayer works with devnet, testnet, and mainnet</LI>
      </UL>

      <H2 id="install-packages">Install Packages</H2>
      <P>
        Install the core SDK and React bindings:
      </P>

      <TabGroup tabs={[
        { label: 'npm', content: 'npm install @partylayer/sdk @partylayer/react', language: 'bash' },
        { label: 'pnpm', content: 'pnpm add @partylayer/sdk @partylayer/react', language: 'bash' },
        { label: 'yarn', content: 'yarn add @partylayer/sdk @partylayer/react', language: 'bash' },
      ]} />

      <Callout type="note">
        <Code>{'@partylayer/core'}</Code> is installed automatically as a dependency of <Code>{'@partylayer/sdk'}</Code>.
        You don{"'"}t need to install it separately.
      </Callout>

      <H2 id="vanilla-js">Vanilla JS Only</H2>
      <P>
        If you{"'"}re not using React, you only need the core SDK:
      </P>

      <TabGroup tabs={[
        { label: 'npm', content: 'npm install @partylayer/sdk', language: 'bash' },
        { label: 'pnpm', content: 'pnpm add @partylayer/sdk', language: 'bash' },
        { label: 'yarn', content: 'yarn add @partylayer/sdk', language: 'bash' },
      ]} />

      <H2 id="optional-packages">Optional Packages</H2>

      <H3>CIP-0103 Native Provider</H3>
      <P>
        For direct CIP-0103 provider integration (e.g., wrapping your PartyLayer client as a
        CIP-0103 compliant provider):
      </P>
      <TabGroup tabs={[
        { label: 'npm', content: 'npm install @partylayer/provider', language: 'bash' },
        { label: 'pnpm', content: 'pnpm add @partylayer/provider', language: 'bash' },
        { label: 'yarn', content: 'yarn add @partylayer/provider', language: 'bash' },
      ]} />

      <H3>Enterprise Wallet (Bron)</H3>
      <P>
        The Bron adapter requires explicit configuration and is not auto-registered:
      </P>
      <CodeBlock language="tsx">{`import { BronAdapter } from '@partylayer/adapter-bron';
import { getBuiltinAdapters } from '@partylayer/sdk';

<PartyLayerKit
  network="mainnet"
  appName="My dApp"
  adapters={[
    ...getBuiltinAdapters(),
    new BronAdapter({
      auth: {
        clientId: '...',
        redirectUri: 'https://your-app.com/auth/callback',
        authorizationUrl: 'https://auth.bron.example/authorize',
        tokenUrl: 'https://auth.bron.example/token',
      },
      api: {
        baseUrl: 'https://api.bron.example',
        getAccessToken: async () => getStoredAccessToken(),
      },
    }),
  ]}
>
  {/* ... */}
</PartyLayerKit>`}</CodeBlock>

      <H2 id="verify">Verify Installation</H2>
      <P>
        After installing, verify everything works by importing the SDK:
      </P>
      <CodeBlock language="tsx">{`import { createPartyLayer } from '@partylayer/sdk';
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

// If these imports resolve without errors, you're good to go!
console.log('PartyLayer installed successfully');`}</CodeBlock>

      <P>
        Next, follow the <A href="/docs/quick-start">Quick Start</A> guide to build your first wallet integration.
      </P>

      <PrevNext />
    </>
  );
}
