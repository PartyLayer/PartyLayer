'use client';

import { useDocs } from '../layout';

export default function CIP0103Page() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, LI, Strong, A } = useDocs();

  return (
    <>
      <H1>CIP-0103: the Canton dApp Standard, implemented</H1>
      <P>
        CIP-0103 is the Canton dApp Standard, the specification for how wallets and dApps communicate
        on the Canton Network. PartyLayer fully implements CIP-0103 with 10 methods, 4 events, and a
        typed error model.
      </P>
      <P>
        For which wallets declare CIP-0103 native support, with the evidence recorded for each, see
        the <A href="/wallets">Canton wallet directory</A>.
      </P>
      <Callout type="note">
        <Strong>Sources.</Strong> Semantics on this page come from{' '}
        <A href="https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md">
          the CIP-0103 specification
        </A>
        . Request and response shapes were read from the published type declarations of{' '}
        <A href="https://www.npmjs.com/package/@canton-network/core-wallet-dapp-rpc-client">
          @canton-network/core-wallet-dapp-rpc-client
        </A>{' '}
        at version 1.11.0, which the standard&apos;s authors ship, <Strong>verified 2026-09-03</Strong>.
        That version is pinned here on purpose: it is the one claim on this page that can go stale
        without anything telling us, so it is stated where a reader can judge its age. For the
        reasoning behind the
        standard rather than its mechanics, read Canton&apos;s own{' '}
        <A href="https://www.canton.network/blog/scaling-canton-apps-with-a-standard-for-wallet-and-app-interoperability">
          Scaling Canton Apps
        </A>{' '}
        and{' '}
        <A href="https://www.canton.network/blog/canton-unlocks-wallet-stack">
          Canton Unlocks the Wallet Stack
        </A>{' '}
        rather than a paraphrase here. Where those sources and this SDK disagree, the{' '}
        <A href="#divergences">divergences</A> section says so.
      </Callout>

      <H2 id="integration-paths">Two Integration Paths</H2>
      <P>PartyLayer supports two ways to integrate:</P>
      <UL>
        <LI>
          <Strong>Adapter SDK</Strong> (recommended), Use <Code>{'PartyLayerKit'}</Code> and React hooks.
          The SDK abstracts CIP-0103 behind a higher-level API.
        </LI>
        <LI>
          <Strong>Native CIP-0103 Provider</Strong>, Work directly with the CIP-0103 provider interface.
          Useful for non-React apps or when you need raw CIP-0103 compliance.
        </LI>
      </UL>

      <H2 id="provider-api">Provider API</H2>
      <P>
        The CIP-0103 provider uses a JSON-RPC-style <Code>{'request()'}</Code> method:
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
    resource: '/v2/state/active-contracts',
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

      <H2 id="divergences">Where the upstream client and this SDK diverge</H2>
      <P>
        This section exists because we are probably the only people positioned to notice. We wrote
        the conformance suite and took wallets through it, so the gaps below come from comparing
        three things that should agree and do not entirely: the specification&apos;s method table, the
        type declarations shipped by{' '}
        <A href="https://www.npmjs.com/package/@canton-network/core-wallet-dapp-rpc-client">
          @canton-network/core-wallet-dapp-rpc-client
        </A>{' '}
        (read at version 1.11.0), and this SDK.
      </P>
      <P>
        A documented divergence is more useful than a false consensus. None of these is a defect in
        anyone&apos;s code; they are places where the standard leaves room and implementations took
        different readings.
      </P>

      <H3>1. prepareExecuteAndWait is in the client, not in the spec&apos;s method table</H3>
      <P>
        The upstream <Code>{'RpcTypes'}</Code> map declares{' '}
        <Code>{'prepareExecuteAndWait'}</Code> as a first-class key returning{' '}
        <Code>{'{ tx: TxChangedExecutedEvent }'}</Code>. The specification&apos;s synchronous method
        table does not list it: there, <Code>{'prepareExecute'}</Code> returns void and the result
        arrives as a <Code>{'txChanged'}</Code> event.
      </P>
      <P>
        This SDK uses it. The WalletConnect and Send adapters both call it, because a single call
        that returns the executed transaction is far easier to build a UI around than a void call
        plus an event subscription. Our <Code>{'CIP0103_METHODS'}</Code> constant nevertheless lists
        ten names and omits it, so the constant tracks the spec while the adapters track the client.
        That is a real inconsistency on our side, not a reading of the standard.
      </P>

      <H3>2. messageSignature exists upstream and not here</H3>
      <P>
        Upstream declares a <Code>{'messageSignature'}</Code> key with three payload shapes,{' '}
        <Code>{'pending'}</Code>, <Code>{'signed'}</Code> and <Code>{'failed'}</Code>, mirroring the
        transaction lifecycle for message signing. It appears in neither the spec&apos;s event table
        nor this SDK. If you need to track a signature request through a multi-step flow, the
        upstream client can express it and our hooks cannot.
      </P>

      <H3>3. Events and methods share one map upstream</H3>
      <P>
        Upstream <Code>{'RpcTypes'}</Code> has fourteen keys. Ten are the spec&apos;s methods, and{' '}
        <Code>{'accountsChanged'}</Code> and <Code>{'txChanged'}</Code> sit alongside them as keys of
        the same map, each typed as a function returning its event payload. The spec lists those two
        as events, not methods.
      </P>
      <P>
        <Strong>This is our interpretive choice:</Strong> we split them, exposing methods through{' '}
        <Code>{'request()'}</Code> and events through <Code>{'on()'}</Code>, because a dApp
        subscribes to an event and calls a method, and collapsing both into one map makes that
        distinction invisible at the call site. The upstream shape is a faithful description of the
        transport, where everything is a JSON-RPC exchange. Neither is wrong; they describe different
        layers.
      </P>

      <H3>4. statusChanged is a spec event with no upstream key</H3>
      <P>
        The spec lists <Code>{'statusChanged'}</Code> as an event carrying{' '}
        <Code>{'StatusEvent'}</Code>. Upstream has no such key: it exposes <Code>{'status'}</Code> as
        a method returning <Code>{'StatusEvent'}</Code> and leaves the change notification out of the
        typed map. We implement the event, following the spec.
      </P>

      <H3>5. connected only exists in the asynchronous variant</H3>
      <P>
        Our <Code>{'CIP0103_EVENTS'}</Code> constant lists four events, and the fourth,{' '}
        <Code>{'connected'}</Code>, comes from the spec&apos;s <Strong>asynchronous</Strong> dApp API,
        where <Code>{'connect'}</Code> returns a <Code>{'userUrl'}</Code> and the wallet emits{' '}
        <Code>{'connected'}</Code> once login completes. A purely synchronous provider never emits
        it.
      </P>
      <P>
        <Strong>Our choice, and a debatable one:</Strong> the constant does not distinguish sync from
        async, so it over-declares for a synchronous wallet. We kept one list because a dApp does not
        know in advance which variant a wallet implements, and a subscription to an event that never
        fires is harmless. The cost is that the constant is not a conformance target for a
        synchronous provider.
      </P>

      <H3>6. completionOffset is dropped</H3>
      <P>
        Upstream&apos;s executed-transaction payload is{' '}
        <Code>{'{ updateId, completionOffset }'}</Code>. Our <Code>{'TxReceipt'}</Code> has no field
        for an offset, so the SDK reads <Code>{'updateId'}</Code> and discards{' '}
        <Code>{'completionOffset'}</Code>. If you need the offset, reach for{' '}
        <Code>{'ledgerApi'}</Code> rather than the receipt.
      </P>

      <Callout type="note">
        Sourcing note. The request and response shapes on this page were read from the published type
        declarations of <Code>{'@canton-network/core-wallet-dapp-rpc-client@1.11.0'}</Code>, which
        the standard&apos;s authors ship and nobody here wrote. Semantics come from the specification.
        Our own constants are corroboration, not the source: a page about a standard we did not
        author should not cite our implementation as evidence about the standard.
      </Callout>

      <H2 id="implement-dapp">Implementing CIP-0103 in a dApp</H2>
      <P>
        You have two options and they differ in how much of the standard you touch. Use the SDK and
        you never write a <Code>{'request()'}</Code> call; use the provider directly and you own the
        whole surface.
      </P>
      <P>
        The SDK route, which is what most applications want:{' '}
        <A href="/docs/quick-start">Quick Start</A> has the working version. The provider route, when
        you are building something the SDK does not cover:
      </P>
      <CodeBlock language="typescript">{`import { discoverInjectedProviders, isCIP0103Provider } from '@partylayer/provider';

// 1. Find providers that announced themselves.
const providers = await discoverInjectedProviders();
const cip = providers.filter((p) => isCIP0103Provider(p.provider));

// 2. Connect. Note both flags: a wallet can be reachable but not on a network.
const provider = cip[0].provider;
const conn = await provider.request<{
  isConnected: boolean;
  isNetworkConnected: boolean;
  reason?: string;
  networkReason?: string;
  userUrl?: string;
}>({ method: 'connect' });

if (conn.userUrl) {
  // Asynchronous wallet: send the user here, then wait for the 'connected' event.
  window.open(conn.userUrl, '_blank');
}

// 3. Read the account. partyId is what the ledger knows the user as.
const account = await provider.request<{ partyId: string; primary: boolean }>({
  method: 'getPrimaryAccount',
});`}</CodeBlock>
      <P>
        Two things worth doing that the standard does not force you to do. Check{' '}
        <Code>{'isNetworkConnected'}</Code> as well as <Code>{'isConnected'}</Code>, because they are
        separate flags with separate reason strings and a wallet that is open but has no network will
        satisfy the first and fail every subsequent call. And handle{' '}
        <Code>{'userUrl'}</Code> on the connect result even if you only expect synchronous wallets,
        since its presence is the only signal that you are talking to an asynchronous one.
      </P>

      <H2 id="implement-wallet">Implementing CIP-0103 in a wallet</H2>
      <P>
        The obligation is narrower than it looks. A wallet must answer the ten methods, emit the three
        synchronous events, and use the error codes below. Everything else is transport.
      </P>
      <UL>
        <LI>
          <Strong>Answer every method, including ones you do not support.</Strong> A method you cannot
          honour returns error <Code>{'4200'}</Code> (Unsupported Method) or{' '}
          <Code>{'-32004'}</Code>. Silence, or a rejection with no code, is what breaks dApps: the
          caller cannot tell refusal from failure.
        </LI>
        <LI>
          <Strong>Announce yourself.</Strong> Provider discovery is how a dApp finds you without a
          per-wallet adapter. See <A href="/docs/generic-bridge">Generic bridge</A> for the two
          discovery paths and what each requires.
        </LI>
        <LI>
          <Strong>Emit txChanged for every phase you reach.</Strong> The lifecycle is{' '}
          <Code>{'pending'}</Code>, <Code>{'signed'}</Code>, <Code>{'executed'}</Code>,{' '}
          <Code>{'failed'}</Code>. A wallet that only emits the terminal state leaves a dApp unable to
          show progress, which is where the pressure to poll comes from.
        </LI>
        <LI>
          <Strong>If you are a remote or server-side wallet, implement the async variant.</Strong>{' '}
          Return a <Code>{'userUrl'}</Code> from <Code>{'connect'}</Code> and{' '}
          <Code>{'prepareExecute'}</Code>, and emit <Code>{'connected'}</Code> after login. That is
          what the variant is for, and it avoids pretending a multi-step flow is synchronous.
        </LI>
      </UL>

      <H2 id="conformance">Verifying compliance</H2>
      <P>
        We ship the conformance suite we used to take wallets through this standard. It runs against
        any CIP-0103 provider, not only ours, and it checks interface shape, that all ten mandatory
        methods are handled, event subscription, error shape, and lifecycle.
      </P>
      <CodeBlock language="typescript">{`import { runCIP0103ConformanceTests } from '@partylayer/conformance-runner';

const report = await runCIP0103ConformanceTests(provider);

console.log(\`\${report.passed}/\${report.total} passed\`);
for (const r of report.results.filter((x) => !x.passed)) {
  console.log(r.category, r.name, r.error);
}`}</CodeBlock>
      <P>
        Results are grouped as <Code>{'interface'}</Code>, <Code>{'method'}</Code>,{' '}
        <Code>{'event'}</Code>, <Code>{'error'}</Code> and <Code>{'lifecycle'}</Code>, so a failure
        tells you which obligation you missed rather than only that something is wrong. What it does
        not do is tell you whether your wallet is correct: it checks that the interface is honoured,
        not that a signature is valid or a transaction reached the ledger.
      </P>

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
      <CodeBlock language="typescript">{`// 4001, User Rejected
// 4100, Unauthorized
// 4200, Unsupported Method
// 4900, Disconnected
// 4901, Chain Disconnected`}</CodeBlock>

      <H3>EIP-1474 Codes</H3>
      <CodeBlock language="typescript">{`// -32700, Parse Error
// -32600, Invalid Request
// -32601, Method Not Found
// -32602, Invalid Params
// -32603, Internal Error
// -32000, Invalid Input
// -32003, Transaction Rejected
// -32005, Limit Exceeded`}</CodeBlock>

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
