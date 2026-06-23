'use client';

import { useDocs } from '../layout';

export default function PartyLayerKitPage() {
  const { H1, H2, P, Code, CodeBlock, PropsTable, Callout, PrevNext, A, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>PartyLayerKit</H1>
      <P>
        <Code>{'PartyLayerKit'}</Code> is the zero-config wrapper component that sets up everything
        your dApp needs for wallet connectivity. It creates the SDK client, registers adapters,
        fetches the wallet registry, and provides theme and session context to all child components.
      </P>

      <H2 id="basic-usage">Basic Usage</H2>
      <CodeBlock language="tsx">{`import { PartyLayerKit } from '@partylayer/react';

function App() {
  return (
    <PartyLayerKit network="mainnet" appName="My dApp">
      {/* Your app components */}
    </PartyLayerKit>
  );
}`}</CodeBlock>

      <H2 id="props">Props</H2>
      <PropsTable data={[
        { prop: 'network', type: '"devnet" | "testnet" | "mainnet"', description: 'Canton network to connect to. Determines which wallets and registry entries are available.' },
        { prop: 'appName', type: 'string', description: 'Your application name, shown to wallets during connection requests.' },
        { prop: 'children', type: 'ReactNode', description: 'Your application component tree.' },
        { prop: 'registryUrl', type: 'string', default: '"https://registry.partylayer.xyz"', description: 'Override the wallet registry URL. Useful for self-hosted registries.' },
        { prop: 'channel', type: '"stable" | "beta"', default: '"stable"', description: 'Registry channel. Use "beta" to include wallets in beta testing.' },
        { prop: 'adapters', type: '(WalletAdapter | AdapterClass)[]', default: 'Built-in adapters', description: 'Custom wallet adapter list. Overrides the default built-in adapters if provided.' },
        { prop: 'theme', type: '"light" | "dark" | "auto" | PartyLayerTheme', default: '"light"', description: 'Theme preset or a custom theme object. "auto" follows system preference.' },
        { prop: 'walletIcons', type: 'Record<string, string>', default: '{}', description: 'Custom wallet icon URLs keyed by walletId. Overrides registry icons.' },
      ]} />

      <H2 id="network-config">Network Configuration</H2>
      <P>
        The <Code>{'network'}</Code> prop determines which Canton network your dApp connects to.
        Wallets and registry entries are filtered by network.
      </P>
      <CodeBlock language="tsx">{`// Development
<PartyLayerKit network="devnet" appName="My dApp">

// Staging / testing
<PartyLayerKit network="testnet" appName="My dApp">

// Production
<PartyLayerKit network="mainnet" appName="My dApp">`}</CodeBlock>

      <H2 id="custom-adapters">Custom Adapters</H2>
      <P>
        By default, <Code>{'PartyLayerKit'}</Code> auto-registers all built-in adapters: Console,
        Loop, Cantor8, and Nightly. To add additional adapters (like Bron) or use a custom set:
      </P>
      <CodeBlock language="tsx">{`import { PartyLayerKit } from '@partylayer/react';
import { getBuiltinAdapters } from '@partylayer/sdk';
import { BronAdapter } from '@partylayer/adapter-bron';

function App() {
  return (
    <PartyLayerKit
      network="mainnet"
      appName="My dApp"
      adapters={[
        ...getBuiltinAdapters(),
        new BronAdapter({
          auth: {
            clientId: 'your-client-id',
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
      {children}
    </PartyLayerKit>
  );
}`}</CodeBlock>

      <Callout type="warning">
        When you provide the <Code>{'adapters'}</Code> prop, it <Strong>replaces</Strong> the
        default set entirely. Always include <Code>{'getBuiltinAdapters()'}</Code> if you want to
        keep the built-in wallets alongside your custom adapter.
      </Callout>

      <H2 id="custom-icons">Custom Wallet Icons</H2>
      <P>
        Override wallet icons with the <Code>{'walletIcons'}</Code> prop. Keys are wallet IDs
        and values are image URLs:
      </P>
      <CodeBlock language="tsx">{`<PartyLayerKit
  network="mainnet"
  appName="My dApp"
  walletIcons={{
    console: '/images/console-logo.png',
    loop: '/images/loop-logo.svg',
    'my-custom-wallet': '/images/custom-wallet.png',
  }}
>`}</CodeBlock>

      <P>
        Icons are resolved with this priority: walletIcons prop (exact match) → walletIcons
        (fuzzy match) → registry icon URL → fallback.
      </P>

      <H2 id="theming">Theming</H2>
      <P>
        Pass a theme preset or a custom <Code>{'PartyLayerTheme'}</Code> object:
      </P>
      <CodeBlock language="tsx">{`// Preset themes
<PartyLayerKit theme="light" ...>
<PartyLayerKit theme="dark" ...>
<PartyLayerKit theme="auto" ...>  {/* Follows system preference */}

// Custom theme
import { lightTheme } from '@partylayer/react';

const myTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: '#7C3AED',
    primaryHover: '#6D28D9',
  },
};

<PartyLayerKit theme={myTheme} ...>`}</CodeBlock>

      <P>
        See <A href="/docs/theming">Theming</A> for full theme customization details.
      </P>

      <H2 id="how-it-works">How It Works</H2>
      <P><Code>{'PartyLayerKit'}</Code> internally:</P>
      <UL>
        <LI>Creates a <Code>{'PartyLayerClient'}</Code> via <Code>{'createPartyLayer()'}</Code></LI>
        <LI>Wraps children in <Code>{'PartyLayerProvider'}</Code> (React context for the SDK client)</LI>
        <LI>Wraps in <Code>{'ThemeProvider'}</Code> (theme context for styled components)</LI>
        <LI>Wraps in <Code>{'WalletIconsContext'}</Code> (icon override context)</LI>
        <LI>Handles client cleanup on unmount via <Code>{'client.destroy()'}</Code></LI>
      </UL>

      <Callout type="tip">
        The client is only re-created when <Code>{'network'}</Code>, <Code>{'appName'}</Code>,
        <Code>{'registryUrl'}</Code>, or <Code>{'channel'}</Code> change. The <Code>{'adapters'}</Code> array
        uses a stable ref to avoid unnecessary re-initialization.
      </Callout>

      <PrevNext />
    </>
  );
}
