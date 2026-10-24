'use client';

import { useDocs } from '../layout';

export default function AdvancedPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, UL, LI, Strong, HR } = useDocs();

  return (
    <>
      <H1>Advanced</H1>
      <P>
        This section covers advanced topics including telemetry, session persistence, registry internals,
        security best practices, and production deployment.
      </P>

      <H2 id="telemetry">Telemetry & Metrics</H2>
      <P>
        PartyLayer includes an opt-in telemetry system for collecting anonymous usage metrics.
        Telemetry is <Strong>disabled by default</Strong> and respects user privacy.
      </P>

      <H3>Enabling Telemetry</H3>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My dApp' },
  telemetry: {
    enabled: true,
    endpoint: 'https://metrics.my-dapp.com/collect',
    sampleRate: 0.1,        // 10% sampling
    batchSize: 10,           // Send in batches of 10
    flushIntervalMs: 30000,  // Flush every 30s
  },
});`}</CodeBlock>

      <H3>Telemetry Configuration</H3>
      <PropsTable data={[
        { prop: 'enabled', type: 'boolean', default: 'false', description: 'Enable/disable telemetry collection.' },
        { prop: 'endpoint', type: 'string', description: 'URL to send telemetry data to.' },
        { prop: 'sampleRate', type: 'number', default: '1.0', description: 'Sampling rate (0.0 to 1.0).' },
        { prop: 'appId', type: 'string', description: 'App identifier (SHA-256 hashed before sending).' },
        { prop: 'includeOrigin', type: 'boolean', default: 'false', description: 'Include dApp origin URL in metrics.' },
        { prop: 'batchSize', type: 'number', default: '10', description: 'Number of events to batch before sending.' },
        { prop: 'flushIntervalMs', type: 'number', default: '30000', description: 'Interval between flushes (ms).' },
      ]} />

      <H3>Collected Metrics</H3>
      <P>The SDK collects 9 canonical metrics:</P>
      <UL>
        <LI><Code>{'wallet_connect_attempts'}</Code>, Total connection attempts</LI>
        <LI><Code>{'wallet_connect_success'}</Code>, Successful connections</LI>
        <LI><Code>{'sessions_created'}</Code>, New sessions created</LI>
        <LI><Code>{'sessions_restored'}</Code>, Sessions restored from storage</LI>
        <LI><Code>{'restore_attempts'}</Code>, Session restore attempts</LI>
        <LI><Code>{'registry_fetch'}</Code>, Registry fetch operations</LI>
        <LI><Code>{'registry_cache_hit'}</Code>, Registry cache hits</LI>
        <LI><Code>{'registry_stale'}</Code>, Stale registry data usage</LI>
        <LI><Code>{'error_<CODE>'}</Code>, Error counts by error code</LI>
      </UL>

      <Callout type="tip" title="Privacy">
        No PII is ever collected. App IDs are SHA-256 hashed before transmission.
        All payloads are validated before sending.
      </Callout>

      <HR />

      <H2 id="session-persistence">Session Persistence</H2>
      <P>
        Session persistence has three distinct layers: the wallet-owned connection, the SDK cache
        and the React live session view. A stored cache or cookie is never proof of wallet
        authorization or application login.
      </P>
      <H3>How It Works</H3>
      <UL>
        <LI>Official native discovery owns its provider-ID hint. The SDK restores a native session only after checking the live provider, party, network, origin and expiry.</LI>
        <LI>Old native caches without that provider hint require one explicit reconnect; failed probes do not display a cached connected account.</LI>
        <LI>The SDK cache uses its configured storage/crypto adapters. The default SDK storage is browser localStorage; its origin-derived crypto encoding is not a secret vault and can fall back to base64. Do not put authentication secrets or keys in this cache.</LI>
        <LI>The React kit uses an in-memory live projection by default. Explicit <Code>sessionOptions.storage</Code> is a UI cache; it does not bypass wallet checks.</LI>
        <LI>Standalone <Code>@partylayer/session</Code> stores default to encrypted IndexedDB where supported and memory otherwise. This standalone default is distinct from the kit and SDK defaults.</LI>
      </UL>
      <H3>Per-Wallet Restore Support</H3>
      <P>
        Restoration depends on wallet support and live authentication. Official popup providers are
        probed before restoration; OneSwap requires a fresh explicit connection. A wallet logout,
        expired session or changed party/network must not be hidden by a saved UI state. Inspect the
        current session and capabilities instead of assuming every wallet silently reconnects.
      </P>


      <H3>Custom Storage</H3>
      <P>Provide a custom storage adapter for non-browser environments:</P>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My dApp' },
  storage: {
    get: (key) => myCustomStorage.get(key),
    set: (key, value) => myCustomStorage.set(key, value),
    remove: (key) => myCustomStorage.delete(key),
    clear: () => myCustomStorage.clear(),
  },
});`}</CodeBlock>

      <HR />

      <H2 id="registry">Registry Internals</H2>
      <P>
        The PartyLayer wallet registry is a JSON manifest of wallet metadata, published from a
        public repository and served from a single HTTPS origin. It is validated against a JSON
        Schema on every build. It is not signed today: see <Strong>Integrity</Strong> below.
      </P>

      <H3>How the Registry Works</H3>
      <UL>
        <LI><Strong>Fetch</Strong>, On init, the SDK fetches the registry from <Code>{'registry.partylayer.xyz'}</Code></LI>
        <LI><Strong>Validate</Strong>, The payload is checked against the registry schema; entries that do not match are rejected</LI>
        <LI><Strong>Cache</Strong>, Validated data is cached with ETag support for efficient updates</LI>
        <LI><Strong>Fallback</Strong>, If the registry is unreachable, the SDK falls back to adapter-only discovery</LI>
      </UL>

      <H3>Integrity</H3>
      <P>
        What protects the registry today is schema validation on every build, a gate that blocks the
        removal of a wallet{"'"}s CIP-0103 native flag, a public commit history, and TLS to a single
        origin. <Strong>Ed25519 signing is implemented in the client but is not enabled in
        production.</Strong> Verification only runs when a consumer passes{' '}
        <Code>{'registryPublicKeys'}</Code>, and no signature is published for either channel, so the
        verification path does not execute. Do not treat registry contents as cryptographically
        attested.
      </P>

      <H3>Custom Registry</H3>
      <CodeBlock language="typescript">{`<PartyLayerKit
  network="mainnet"
  appName="My dApp"
  registryUrl="https://my-registry.example.com"
  channel="beta"
>`}</CodeBlock>

      <H3>Registry Status</H3>
      <P>Monitor registry health with <Code>{'useRegistryStatus'}</Code> or the <Code>{'registry:status'}</Code> event:</P>
      <CodeBlock language="typescript">{`client.on('registry:status', (event) => {
  const { status } = event;

  if (status.error) {
    console.warn('Registry error:', status.error.message);
    console.log('Using cached data:', status.source === 'cache');
  }

  console.log('Verified:', status.verified);
  console.log('Stale:', status.stale);
});`}</CodeBlock>

      <HR />

      <H2 id="security">Security</H2>

      <H3>Content Security Policy (CSP)</H3>
      <P>
        If your dApp uses CSP headers, ensure these are allowed:
      </P>
      <CodeBlock language="text">{`connect-src 'self' https://registry.partylayer.xyz;
frame-src 'self';  /* For popup-based wallets */`}</CodeBlock>

      <H3>Origin Validation</H3>
      <P>
        PartyLayer validates the dApp origin during wallet connections. The origin is included
        in session metadata and verified by wallets. This prevents session hijacking across domains.
      </P>

      <H3>Transport Security</H3>
      <UL>
        <LI><Strong>PostMessage</Strong>, Origin is validated on every message exchange</LI>
        <LI><Strong>Deep Links</Strong>, HTTPS-only with app-link verification</LI>
        <LI><Strong>Injected</Strong>, Direct in-process communication (no network)</LI>
        <LI><Strong>QR/Popup</Strong>, Encrypted channel with session key exchange</LI>
      </UL>

      <HR />

      <H2 id="production">Production Checklist</H2>
      <P>Before deploying to production:</P>

      <UL>
        <LI>Set <Code>{'network'}</Code> to <Code>{'"mainnet"'}</Code></LI>
        <LI>Use the <Code>{'"stable"'}</Code> registry channel (default)</LI>
        <LI>Test with all supported wallets</LI>
        <LI>Add error handling for all operations (connect, sign, submit)</LI>
        <LI>Subscribe to the <Code>{'error'}</Code> event for global error reporting</LI>
        <LI>Configure CSP headers for your domain</LI>
        <LI>Call <Code>{'client.destroy()'}</Code> on app unmount (automatic with <Code>{'PartyLayerKit'}</Code>)</LI>
        <LI>Test session restoration (page reload should maintain connection)</LI>
        <LI>Verify registry fallback works (test with network offline)</LI>
        <LI>If using telemetry, configure your endpoint and sampling rate</LI>
      </UL>

      <Callout type="warning">
        Never expose registry public keys or telemetry endpoints in client-side code if they
        contain sensitive information. Use environment variables and server-side configuration.
      </Callout>

      <H2 id="lower-level">Lower-Level Provider (PartyLayerProvider)</H2>
      <P>
        If you need more control than <Code>{'PartyLayerKit'}</Code> provides, use the lower-level
        {' '}<Code>{'PartyLayerProvider'}</Code> directly:
      </P>
      <CodeBlock language="tsx">{`import { PartyLayerProvider, ThemeProvider } from '@partylayer/react';
import { createPartyLayer } from '@partylayer/sdk';

// Create and configure the client manually
const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My dApp', origin: 'https://my-dapp.com' },
  registryUrl: 'https://my-registry.example.com',
  storage: customStorageAdapter,
  telemetry: { enabled: true, endpoint: '...' },
  logger: customLogger,
});

function App() {
  return (
    <ThemeProvider theme="dark">
      <PartyLayerProvider client={client} network="mainnet">
        {/* Full manual control */}
      </PartyLayerProvider>
    </ThemeProvider>
  );
}`}</CodeBlock>

      <PrevNext />
    </>
  );
}
