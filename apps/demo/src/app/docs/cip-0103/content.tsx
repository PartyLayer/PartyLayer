'use client';

import { useDocs } from '../layout';

export default function CIP0103Page() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, LI, Strong } = useDocs();

  return (
    <>
      <H1>CIP-0103 Provider</H1>
      <P>
        CIP-0103 is the Canton dApp Standard — the specification for how wallets and dApps communicate
        on the Canton Network. PartyLayer fully implements CIP-0103 with 10 methods, 4 events, and a
        typed error model.
      </P>

      <H2 id="integration-paths">Two Integration Paths</H2>
      <P>PartyLayer supports two ways to integrate:</P>
      <UL>
        <LI>
          <Strong>Adapter SDK</Strong> (recommended) — Use <Code>{'PartyLayerKit'}</Code> and React hooks.
          The SDK abstracts CIP-0103 behind a higher-level API.
        </LI>
        <LI>
          <Strong>Native CIP-0103 Provider</Strong> — Work directly with the CIP-0103 provider interface.
          Useful for non-React apps or when you need raw CIP-0103 compliance.
        </LI>
      </UL>

      <H2 id="provider-api">Provider API</H2>
      <P>
        The CIP-0103 provider uses a JSON-RPC–style <Code>{'request()'}</Code> method:
      </P>
      <CodeBlock language="typescript">{`interface CIP0103Provider {
  request<T>(args: { method: string; params?: unknown }): Promise<T>;
  on<T>(event: string, listener: (data: T) => void): CIP0103Provider;
  emit<T>(event: string, ...args: T[]): boolean;
  removeListener<T>(event: string, listener: (data: T) => void): CIP0103Provider;
}`}</CodeBlock>

      <H2 id="methods">10 Mandatory Methods</H2>

      <H3>connect</H3>
      <P>Establish a connection to the wallet.</P>
      <CodeBlock language="typescript">{`const result = await provider.request<CIP0103ConnectResult>({
  method: 'connect',
});
// → { isConnected: true, isNetworkConnected: true }`}</CodeBlock>

      <H3>disconnect</H3>
      <CodeBlock language="typescript">{`await provider.request({ method: 'disconnect' });`}</CodeBlock>

      <H3>isConnected</H3>
      <CodeBlock language="typescript">{`const status = await provider.request<CIP0103ConnectResult>({
  method: 'isConnected',
});
// → { isConnected: true/false }`}</CodeBlock>

      <H3>status</H3>
      <P>Get full provider status including connection, provider info, network, and session.</P>
      <CodeBlock language="typescript">{`const status = await provider.request<CIP0103StatusEvent>({
  method: 'status',
});
// → { connection: {...}, provider: { id, version, providerType }, network?: {...}, session?: {...} }`}</CodeBlock>

      <H3>getActiveNetwork</H3>
      <P>Get the active network in CAIP-2 format.</P>
      <CodeBlock language="typescript">{`const network = await provider.request<CIP0103Network>({
  method: 'getActiveNetwork',
});
// → { networkId: 'canton:da-mainnet', ledgerApi: '...', accessToken: '...' }`}</CodeBlock>

      <H3>listAccounts</H3>
      <CodeBlock language="typescript">{`const accounts = await provider.request<CIP0103Account[]>({
  method: 'listAccounts',
});
// → [{ primary: true, partyId: '...', status: 'allocated', ... }]`}</CodeBlock>

      <H3>getPrimaryAccount</H3>
      <CodeBlock language="typescript">{`const account = await provider.request<CIP0103Account>({
  method: 'getPrimaryAccount',
});
// → { primary: true, partyId: '...', publicKey: '...', status: 'allocated' }`}</CodeBlock>

      <H3>signMessage</H3>
      <CodeBlock language="typescript">{`const result = await provider.request<{ signature: string }>({
  method: 'signMessage',
  params: { message: 'Hello Canton!' },
});
// → { signature: '0x...' }`}</CodeBlock>

      <H3>prepareExecute</H3>
      <P>Prepare and submit a Daml command for execution.</P>
      <CodeBlock language="typescript">{`await provider.request({
  method: 'prepareExecute',
  params: {
    commands: [{ templateId: '...', choiceId: '...', argument: {...} }],
  },
});`}</CodeBlock>

      <H3>ledgerApi</H3>
      <P>Proxy requests to the Canton Ledger API through the wallet.</P>
      <CodeBlock language="typescript">{`const result = await provider.request<CIP0103LedgerApiResponse>({
  method: 'ledgerApi',
  params: {
    requestMethod: 'POST',
    resource: '/v2/state/acs',
    body: JSON.stringify({
      filter: {
        filtersByParty: {
          [partyId]: {
            inclusive: {
              templateFilters: [{ templateId: 'Splice.Amulet:Amulet' }],
            },
          },
        },
      },
    }),
  },
});`}</CodeBlock>

      <H2 id="events">4 Events</H2>

      <H3>statusChanged</H3>
      <P>Emitted when the provider status changes.</P>
      <CodeBlock language="typescript">{`provider.on('statusChanged', (status: CIP0103StatusEvent) => {
  console.log('Connection:', status.connection.isConnected);
  console.log('Provider:', status.provider.id);
});`}</CodeBlock>

      <H3>accountsChanged</H3>
      <CodeBlock language="typescript">{`provider.on('accountsChanged', (accounts: CIP0103Account[]) => {
  console.log('Accounts:', accounts.map(a => a.partyId));
});`}</CodeBlock>

      <H3>txChanged</H3>
      <P>Transaction lifecycle events (pending → signed → executed or failed).</P>
      <CodeBlock language="typescript">{`provider.on('txChanged', (event: CIP0103TxChangedEvent) => {
  switch (event.status) {
    case 'pending':
      console.log('TX pending:', event.commandId);
      break;
    case 'signed':
      console.log('TX signed:', event.payload.signature);
      break;
    case 'executed':
      console.log('TX executed:', event.payload.updateId);
      break;
    case 'failed':
      console.log('TX failed:', event.commandId);
      break;
  }
});`}</CodeBlock>

      <H3>connected</H3>
      <P>Emitted when an async connect completes.</P>
      <CodeBlock language="typescript">{`provider.on('connected', (result: CIP0103ConnectResult) => {
  console.log('Async connect completed:', result.isConnected);
});`}</CodeBlock>

      <H2 id="bridge">Provider Bridge</H2>
      <P>
        Wrap your <Code>{'PartyLayerClient'}</Code> as a CIP-0103 provider using <Code>{'asProvider()'}</Code>:
      </P>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My dApp' },
});

// Bridge to CIP-0103
const provider = client.asProvider();

// Now use standard CIP-0103 methods
const result = await provider.request({ method: 'connect' });
const accounts = await provider.request({ method: 'listAccounts' });`}</CodeBlock>

      <Callout type="tip">
        Use the bridge when you need to expose a CIP-0103 compliant interface to third-party
        libraries or tools that expect a raw CIP-0103 provider.
      </Callout>

      <H2 id="discovery">Provider Discovery</H2>
      <CodeBlock language="typescript">{`import {
  discoverInjectedProviders,
  waitForProvider,
  isCIP0103Provider,
} from '@partylayer/provider';

// Scan window.canton.* for all injected providers
const providers = discoverInjectedProviders();
// → [{ id: 'console', provider: CIP0103Provider }, ...]

// Wait for a specific provider to appear (returns null if not found)
const discovered = await waitForProvider('nightly', 5000);
if (discovered) {
  console.log('Found:', discovered.id, discovered.provider);
}

// Duck-type check
if (isCIP0103Provider(window.canton?.console)) {
  console.log('Console wallet is CIP-0103 compliant');
}`}</CodeBlock>

      <H2 id="network-utils">Network Utilities (CAIP-2)</H2>
      <P>Convert between PartyLayer network IDs and CAIP-2 format:</P>
      <CodeBlock language="typescript">{`import { toCAIP2Network, fromCAIP2Network, isValidCAIP2 } from '@partylayer/provider';

toCAIP2Network('mainnet');           // → { networkId: 'canton:da-mainnet' }
fromCAIP2Network('canton:da-testnet'); // → 'testnet'
isValidCAIP2('canton:da-mainnet');  // → true
isValidCAIP2('not-a-network');      // → false (no colon separator)`}</CodeBlock>

      <H2 id="error-model">Error Model</H2>
      <P>
        CIP-0103 uses <Code>{'ProviderRpcError'}</Code> with EIP-1193 and EIP-1474 numeric error codes:
      </P>

      <H3>EIP-1193 Codes</H3>
      <CodeBlock language="typescript">{`// 4001 — User Rejected
// 4100 — Unauthorized
// 4200 — Unsupported Method
// 4900 — Disconnected
// 4901 — Chain Disconnected`}</CodeBlock>

      <H3>EIP-1474 Codes</H3>
      <CodeBlock language="typescript">{`// -32700 — Parse Error
// -32600 — Invalid Request
// -32601 — Method Not Found
// -32602 — Invalid Params
// -32603 — Internal Error
// -32000 — Invalid Input
// -32003 — Transaction Rejected
// -32005 — Limit Exceeded`}</CodeBlock>

      <H3>Error Mapping</H3>
      <P>
        Convert between PartyLayer errors and CIP-0103 RPC errors:
      </P>
      <CodeBlock language="typescript">{`import { toProviderRpcError, toPartyLayerError } from '@partylayer/provider';

// PartyLayer → CIP-0103
const rpcError = toProviderRpcError(new UserRejectedError('connect'));
// → ProviderRpcError { code: 4001, message: 'User Rejected' }

// CIP-0103 → PartyLayer
const plError = toPartyLayerError(rpcError);
// → UserRejectedError { code: 'USER_REJECTED' }`}</CodeBlock>

      <PrevNext />
    </>
  );
}
