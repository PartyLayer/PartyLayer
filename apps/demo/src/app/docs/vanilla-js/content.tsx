'use client';

import { useDocs } from '../layout';

export default function VanillaJsPage() {
  const { H1, H2, H3, P, Code, CodeBlock, PropsTable, Callout, PrevNext, A, HR, Strong } = useDocs();

  return (
    <>
      <H1>Vanilla JS</H1>
      <P>
        Use PartyLayer without React by working directly with the <Code>{'PartyLayerClient'}</Code>.
        This is the foundation the React hooks are built on.
      </P>

      <H2 id="create-client">Creating a Client</H2>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: {
    name: 'My dApp',
    origin: window.location.origin,
  },
});`}</CodeBlock>

      <H2 id="config">Configuration Options</H2>
      <PropsTable data={[
        { prop: 'network', type: '"devnet" | "testnet" | "mainnet"', description: 'Canton network to connect to.' },
        { prop: 'app.name', type: 'string', description: 'Your application name, shown during wallet connection.' },
        { prop: 'app.origin', type: 'string', default: 'window.location.origin', description: 'Origin URL for session binding.' },
        { prop: 'registryUrl', type: 'string', default: '"https://registry.partylayer.xyz"', description: 'Wallet registry URL.' },
        { prop: 'channel', type: '"stable" | "beta"', default: '"stable"', description: 'Registry channel.' },
        { prop: 'storage', type: 'StorageAdapter', default: 'localStorage', description: 'Custom storage adapter for session persistence.' },
        { prop: 'crypto', type: 'CryptoAdapter', description: 'Custom crypto adapter.' },
        { prop: 'registryPublicKeys', type: 'string[]', description: 'Public keys for registry signature verification.' },
        { prop: 'adapters', type: '(WalletAdapter | AdapterClass)[]', default: 'Built-in adapters', description: 'Custom adapter list.' },
        { prop: 'telemetry', type: 'TelemetryConfig | TelemetryAdapter', description: 'Telemetry configuration (opt-in).' },
        { prop: 'logger', type: 'LoggerAdapter', description: 'Custom logger adapter.' },
      ]} />

      <H2 id="wallet-management">Wallet Management</H2>

      <H3>listWallets</H3>
      <P>
        List all available wallets from the registry and registered adapters.
        Resilient — falls back to adapter-only list if the registry is unreachable.
      </P>
      <CodeBlock language="typescript">{`const wallets = await client.listWallets();

for (const wallet of wallets) {
  console.log(wallet.name, wallet.walletId);
  console.log('  Capabilities:', wallet.capabilities);
  console.log('  Networks:', wallet.networks);
}

// With filter
const signingWallets = await client.listWallets({
  requiredCapabilities: ['signTransaction'],
  includeExperimental: false,
});`}</CodeBlock>

      <HR />

      <H3>registerAdapter</H3>
      <P>Register a custom wallet adapter at runtime.</P>
      <CodeBlock language="typescript">{`import { BronAdapter } from '@partylayer/adapter-bron';

client.registerAdapter(new BronAdapter({ clientId: 'your-client-id' }));`}</CodeBlock>

      <H2 id="session-management">Session Management</H2>

      <H3>connect</H3>
      <P>
        Connect to a wallet. Returns a <Code>{'Session'}</Code> on success.
      </P>
      <CodeBlock language="typescript">{`// Connect to a specific wallet
const session = await client.connect({ walletId: 'console' });
console.log('Connected:', session.partyId);
console.log('Session ID:', session.sessionId);

// Let the user choose (when using with a UI)
const session = await client.connect();`}</CodeBlock>

      <HR />

      <H3>disconnect</H3>
      <P>Disconnect the active session.</P>
      <CodeBlock language="typescript">{`await client.disconnect();`}</CodeBlock>

      <HR />

      <H3>getActiveSession</H3>
      <P>Get the current active session, if any.</P>
      <CodeBlock language="typescript">{`const session = await client.getActiveSession();

if (session) {
  console.log('Active session:', session.walletId, session.partyId);
} else {
  console.log('No active session');
}`}</CodeBlock>

      <H2 id="signing">Signing Operations</H2>

      <H3>signMessage</H3>
      <CodeBlock language="typescript">{`const signed = await client.signMessage({
  message: 'Hello Canton!',
  nonce: crypto.randomUUID(),
  domain: 'my-dapp.example.com',
});

console.log('Signature:', signed.signature);
console.log('Signed by:', signed.partyId);`}</CodeBlock>

      <HR />

      <H3>signTransaction</H3>
      <CodeBlock language="typescript">{`const signed = await client.signTransaction({
  tx: {
    templateId: 'MyModule:MyTemplate',
    choiceId: 'MyChoice',
    argument: { amount: '100', recipient: 'party::...' },
  },
});

console.log('TX Hash:', signed.transactionHash);
console.log('Signed TX:', signed.signedTx);`}</CodeBlock>

      <HR />

      <H3>submitTransaction</H3>
      <CodeBlock language="typescript">{`const receipt = await client.submitTransaction({
  signedTx: signedPayload,  // Pass the signed transaction from signTransaction()
});

console.log('TX Hash:', receipt.transactionHash);
console.log('Command ID:', receipt.commandId);
console.log('Submitted at:', new Date(receipt.submittedAt));`}</CodeBlock>

      <H2 id="ledger-api">Ledger API</H2>
      <P>
        Proxy requests to the Canton Ledger API through the connected wallet. Returns raw JSON
        responses that must be parsed with <Code>{'JSON.parse()'}</Code>.
      </P>
      <CodeBlock language="typescript">{`// Query active contracts (wallet balances)
const result = await client.ledgerApi({
  requestMethod: 'POST',
  resource: '/v2/state/acs',
  body: JSON.stringify({
    filter: {
      filtersByParty: {
        [session.partyId]: {
          inclusive: {
            templateFilters: [{ templateId: 'Splice.Amulet:Amulet' }],
          },
        },
      },
    },
  }),
});

const { activeContracts = [] } = JSON.parse(result.response);
console.log('Contracts found:', activeContracts.length);

// Submit a command directly
const submitResult = await client.ledgerApi({
  requestMethod: 'POST',
  resource: '/v2/commands/submit-and-wait',
  body: JSON.stringify(commandPayload),
});`}</CodeBlock>
      <P>
        <Strong>Params:</Strong> <Code>{'{ requestMethod: "GET" | "POST" | "PUT" | "DELETE", resource: string, body?: string }'}</Code>
      </P>
      <P>
        <Strong>Returns:</Strong> <Code>{'{ response: string }'}</Code> — raw JSON from the Canton Ledger API.
      </P>
      <Callout type="note">
        Not all wallets support <Code>{'ledgerApi'}</Code>. Cantor8 does not support it at all.
        Loop supports a limited set of endpoints (ACS queries and command submission).
        See <A href="/docs/wallets#capability-matrix">Capability Matrix</A> and{' '}
        <A href="/docs/wallet-balances">Wallet Balances</A> for details.
      </Callout>

      <HR />

      <H2 id="events">Events</H2>
      <P>
        Subscribe to SDK events with <Code>{'on'}</Code>. The method returns an unsubscribe function.
      </P>
      <CodeBlock language="typescript">{`// Session events
const unsub1 = client.on('session:connected', (event) => {
  console.log('Connected:', event.session.partyId);
});

const unsub2 = client.on('session:disconnected', (event) => {
  console.log('Disconnected:', event.sessionId);
});

const unsub3 = client.on('session:expired', (event) => {
  console.log('Session expired:', event.sessionId);
});

// Transaction status
const unsub4 = client.on('tx:status', (event) => {
  console.log('TX', event.txId, '→', event.status);
  // status: 'pending' | 'submitted' | 'committed' | 'rejected' | 'failed'
});

// Registry updates
const unsub5 = client.on('registry:status', (event) => {
  console.log('Registry:', event.status.source, event.status.verified);
});

// Errors
const unsub6 = client.on('error', (event) => {
  console.error('SDK error:', event.error.message);
});

// Unsubscribe when done
unsub1();
unsub2();`}</CodeBlock>

      <H2 id="cip0103-bridge">CIP-0103 Provider Bridge</H2>
      <P>
        Get a CIP-0103 compliant provider wrapping the client:
      </P>
      <CodeBlock language="typescript">{`const provider = client.asProvider();

// Use CIP-0103 standard methods
const result = await provider.request({ method: 'connect' });
const accounts = await provider.request({ method: 'listAccounts' });

// Subscribe to CIP-0103 events
provider.on('statusChanged', (status) => {
  console.log('Provider status:', status);
});`}</CodeBlock>
      <P>
        See <A href="/docs/cip-0103">CIP-0103 Provider</A> for the complete provider API.
      </P>

      <H2 id="cleanup">Cleanup</H2>
      <CodeBlock language="typescript">{`// Always destroy the client when done
// Flushes telemetry, removes event listeners, cleans up resources
client.destroy();`}</CodeBlock>

      <Callout type="warning">
        Always call <Code>{'client.destroy()'}</Code> when your application unmounts or the client is
        no longer needed. This prevents memory leaks and ensures telemetry data is flushed.
      </Callout>

      <H2 id="complete-example">Complete Example</H2>
      <CodeBlock language="typescript" title="vanilla-wallet-app.ts">{`import { createPartyLayer } from '@partylayer/sdk';

async function main() {
  // 1. Create client
  const client = createPartyLayer({
    network: 'mainnet',
    app: { name: 'My Vanilla dApp' },
  });

  // 2. Listen for events
  client.on('session:connected', (e) => {
    console.log('Connected to', e.session.walletId);
  });

  client.on('error', (e) => {
    console.error('Error:', e.error.message);
  });

  // 3. List available wallets
  const wallets = await client.listWallets();
  console.log('Available wallets:', wallets.map(w => w.name));

  // 4. Connect
  const session = await client.connect({ walletId: 'console' });
  console.log('Party ID:', session.partyId);

  // 5. Sign a message
  const signed = await client.signMessage({
    message: 'Verify ownership',
    nonce: crypto.randomUUID(),
  });
  console.log('Signature:', signed.signature);

  // 6. Disconnect
  await client.disconnect();

  // 7. Cleanup
  client.destroy();
}

main().catch(console.error);`}</CodeBlock>

      <PrevNext />
    </>
  );
}
