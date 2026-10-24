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
        { prop: 'locale', type: 'string', default: '"en"', description: 'Connection UI language: English/Turkish language tags; unsupported tags fall back to English.' },
        { prop: 'direction', type: '"ltr" | "rtl"', default: '"ltr"', description: 'Text and layout direction for PartyLayer UI.' },
        { prop: 'authentication', type: 'PartyLayerAuthenticationAdapter', description: 'Application backend integration for server-verified sign-in. Omitted means wallet connection only.' },
        { prop: 'showAttribution', type: 'boolean', default: 'true', description: 'Show Powered by PartyLayer in the connection modal.' },
        { prop: 'disclaimer', type: 'ReactNode', description: 'Optional application terms/privacy content in the modal footer.' },
        { prop: 'children', type: 'ReactNode', description: 'Your application component tree.' },
        { prop: 'registryUrl', type: 'string', default: '"https://registry.partylayer.xyz"', description: 'Override the wallet registry URL. Useful for self-hosted registries.' },
        { prop: 'channel', type: '"stable" | "beta"', default: '"stable"', description: 'Registry channel. Use "beta" to include wallets in beta testing.' },
        { prop: 'adapters', type: '(WalletAdapter | AdapterClass | OfficialProviderAdapter | OfficialAdapterFactory)[]', default: 'Default wallet catalog', description: 'Custom wallet adapter list. Overrides the default built-in adapters if provided. Also accepts official provider adapters and adapter factories.' },
        { prop: 'walletConnect', type: 'WalletConnectAdapterConfig', description: 'Your Cloud project id and optional pairing metadata. No separate wallet package needed.' },
        { prop: 'bron', type: 'BronAdapterConfig', description: 'Your Bron OAuth/API configuration. Hidden when omitted.' },
        { prop: 'additionalAdapters', type: 'PartyLayerConfig["adapters"]', description: 'Extend the default catalog with custom adapters.' },
        { prop: 'theme', type: '"light" | "dark" | "auto" | PartyLayerTheme', default: '"light"', description: 'Theme preset or a custom theme object. "auto" follows system preference.' },
        { prop: 'walletIcons', type: 'Record<string, string>', default: '{}', description: 'Custom wallet icon URLs keyed by walletId. Overrides registry icons.' },
        { prop: 'walletOrder', type: 'readonly string[]', description: 'Wallet ids in display order for the connect modal. Unlisted wallets fall to the end; sorting applies within the CIP-0103 Native and Available sections.' },
        { prop: 'sessionOptions', type: 'Partial<SessionStoreOptions>', description: 'Session-store options forwarded to PartyLayerProvider (reconnect, expiry, broadcast, persistSnapshot, storage, onInvalidate) for explicit persistence, reconnect and multi-tab behavior. The kit uses an in-memory live session view by default.' },
      ]} />

      <H2 id="localization">UI Language and Direction</H2>
      <CodeBlock language="tsx">{`<PartyLayerKit network="devnet" appName="My dApp" locale="tr-TR" direction="rtl">
  <ConnectButton />
</PartyLayerKit>`}</CodeBlock>
      <P>
        English is the default; Turkish tags such as <Code>tr</Code> and <Code>tr-TR</Code>
        select Turkish. Unsupported language tags fall back to English. Changing language
        or direction preserves the client and wallet connection. The explicit setting is
        shared by server and client; browser language is not guessed automatically.
      </P>
      <P>
        This translates PartyLayer connection, account, cost and transaction UI, including
        accessible labels. Your application content, custom labels, wallet names, identifiers,
        provider error details and vendor approval screens retain their own language settings.
        Advanced provider compositions can use <Code>PartyLayerLocaleProvider</Code> with
        the same <Code>locale</Code> and <Code>direction</Code> props.
      </P>

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
        By default, <Code>{'PartyLayerKit'}</Code> supplies the supported wallet catalog for your network
        and channel. Configure WalletConnect and Bron through application options:
      </P>
      <CodeBlock language="tsx">{`import { PartyLayerKit, ConnectButton } from '@partylayer/react';

const walletConnect = { projectId: 'your-walletconnect-project-id' };
const bron = {
  auth: {
    clientId: 'your-client-id',
    redirectUri: 'https://your-app.com/auth/callback',
    authorizationUrl: 'https://auth.bron.example/authorize',
    tokenUrl: 'https://auth.bron.example/token',
  },
  api: { baseUrl: 'https://api.bron.example' },
};

<PartyLayerKit network="mainnet" appName="My dApp" walletConnect={walletConnect} bron={bron}>
  <ConnectButton />
</PartyLayerKit>`}</CodeBlock>

      <Callout type="warning">
        When you provide the <Code>{'adapters'}</Code> prop, it <Strong>replaces</Strong> the
        default catalog entirely. Use <Code>{'additionalAdapters'}</Code> to extend it while retaining
        the official SDKs and CIP-0103 discovery.
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
        The client is re-created when <Code>{'network'}</Code>, <Code>{'appName'}</Code>,
        <Code>{'registryUrl'}</Code>, <Code>{'channel'}</Code>, <Code>additionalAdapters</Code>,
        <Code>walletConnect</Code> or <Code>bron</Code> change. Keep configuration objects stable.
        Configure the replacement <Code>adapters</Code> catalog at mount; changing that array alone
        does not rebuild the client. Theme, locale and direction changes preserve the connection.
      </Callout>

      <PrevNext />
    </>
  );
}
