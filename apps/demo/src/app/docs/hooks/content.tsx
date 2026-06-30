'use client';

import { useDocs } from '../layout';

export default function HooksPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, A, Strong, HR } = useDocs();

  return (
    <>
      <H1>React Hooks</H1>
      <P>
        PartyLayer provides React hooks for accessing wallet state, performing operations,
        and managing sessions. The hooks below are the main entrypoint (<Code>{'@partylayer/react'}</Code>):
        they use <Code>{'useSyncExternalStore'}</Code> and must be used within a <Code>{'PartyLayerKit'}</Code> or
        {' '}<Code>{'PartyLayerProvider'}</Code>. v2 also adds a TanStack Query powered{' '}
        <Code>{'@partylayer/react/query'}</Code> entrypoint for ledger data and cost, documented in
        {' '}<A href="#query-hooks">Data hooks</A> at the end of this page.
      </P>

      {/* ── Core Hooks ── */}
      <H2 id="core-hooks">Core Hooks</H2>

      <H3 id="use-party-layer">usePartyLayer</H3>
      <P>Access the underlying <Code>{'PartyLayerClient'}</Code> instance directly.</P>
      <CodeBlock language="tsx">{`import { usePartyLayer } from '@partylayer/react';

function Advanced() {
  const client = usePartyLayer();

  // Access any client method
  const wallets = await client.listWallets();
  const provider = client.asProvider();
}`}</CodeBlock>
      <Callout type="note">
        Use this hook when you need direct access to the SDK client for operations
        not covered by the other hooks (e.g., <Code>{'asProvider()'}</Code>, <Code>{'registerAdapter()'}</Code>).
      </Callout>

      <HR />

      <H3 id="use-session">useSession</H3>
      <P>
        Reactive session state <Strong>and</Strong> actions. Re-renders on every session change.
        This returns <Code>{'UseSessionReturn'}</Code> (the reactive store), not the
        legacy SDK session getter.
      </P>
      <CodeBlock language="tsx">{`import { useSession } from '@partylayer/react';

function Profile() {
  const { status, account, networkId, isConnected, disconnect } = useSession();

  if (!isConnected) return <p>Not connected ({status})</p>;

  return (
    <div>
      <p>Party ID: {account?.partyId}</p>
      <p>Network: {networkId}</p>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'UseSessionReturn'}</Code>, the reactive{' '}
        <Code>{'SessionState'}</Code> (<Code>{'status'}</Code>, <Code>{'account'}</Code>,{' '}
        <Code>{'accounts'}</Code>, <Code>{'networkId'}</Code>, <Code>{'lastError'}</Code>) plus{' '}
        <Code>{'isConnected'}</Code>/<Code>{'isConnecting'}</Code>/<Code>{'isReconnecting'}</Code>/
        <Code>{'isDisconnected'}</Code> and the actions <Code>{'connect'}</Code>,{' '}
        <Code>{'disconnect'}</Code>, <Code>{'restore'}</Code>, <Code>{'on'}</Code>.
      </P>
      <Callout type="warning">
        <Strong>Migration:</Strong> <Code>{'useSession()'}</Code> was re-pointed from the
        SDK-layer session getter (<Code>{'Session | null'}</Code>) to the reactive store. The old
        getter is preserved VERBATIM as <Code>{'useClientSession()'}</Code> (deprecated): it still
        returns the <Code>{'Session'}</Code> object (<Code>{'sessionId'}</Code>, <Code>{'walletId'}</Code>,
        {' '}<Code>{'partyId'}</Code>, <Code>{'network'}</Code>, …). Migrate{' '}
        <Code>{'useSession()'}</Code> → <Code>{'useClientSession()'}</Code> if you need that shape.
      </Callout>

      <HR />

      <H3 id="use-wallets">useWallets</H3>
      <P>
        Fetch and list all available wallets (from both the registry and registered adapters).
      </P>
      <CodeBlock language="tsx">{`import { useWallets } from '@partylayer/react';

function WalletList() {
  const { wallets, isLoading, error } = useWallets();

  if (isLoading) return <p>Loading wallets...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {wallets.map(w => (
        <li key={w.walletId}>
          {w.name}: {w.capabilities.join(', ')}
        </li>
      ))}
    </ul>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ wallets: WalletInfo[], isLoading: boolean, error: Error | null }'}</Code>
      </P>

      {/* ── Connection Hooks ── */}
      <H2 id="connection-hooks">Connection Hooks</H2>

      <H3 id="use-connect">useConnect</H3>
      <P>Connect to a wallet programmatically.</P>
      <CodeBlock language="tsx">{`import { useConnect } from '@partylayer/react';

function CustomConnect() {
  const { connect, isConnecting, error, reset } = useConnect();

  const handleConnect = async () => {
    const session = await connect({ walletId: 'console' });
    if (session) {
      console.log('Connected:', session.partyId);
    }
  };

  return (
    <div>
      <button onClick={handleConnect} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Console'}
      </button>
      {error && (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={reset}>Reset</button>
        </div>
      )}
    </div>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ connect: (options?) => Promise<Session | null>, isConnecting: boolean, error: Error | null, reset: () => void }'}</Code>
      </P>
      <P>
        The <Code>{'options'}</Code> parameter accepts: <Code>{'walletId'}</Code> (optional: if omitted, opens the modal).
      </P>

      <HR />

      <H3 id="use-disconnect">useDisconnect</H3>
      <P>Disconnect the active wallet session.</P>
      <CodeBlock language="tsx">{`import { useDisconnect } from '@partylayer/react';

function DisconnectButton() {
  const { disconnect, isDisconnecting, error } = useDisconnect();

  return (
    <button onClick={() => disconnect()} disabled={isDisconnecting}>
      {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
    </button>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ disconnect: () => Promise<void>, isDisconnecting: boolean, error: Error | null }'}</Code>
      </P>

      {/* ── Signing Hooks ── */}
      <H2 id="signing-hooks">Signing Hooks</H2>

      <H3 id="use-sign-message">useSignMessage</H3>
      <P>Sign an arbitrary message with the connected wallet.</P>
      <CodeBlock language="tsx">{`import { useSignMessage } from '@partylayer/react';

function SignDemo() {
  const { signMessage, isSigning, error } = useSignMessage();

  const handleSign = async () => {
    const result = await signMessage({
      message: 'Hello from PartyLayer!',
      nonce: crypto.randomUUID(),
    });

    if (result) {
      console.log('Signature:', result.signature);
      console.log('Signed by:', result.partyId);
    }
  };

  return (
    <button onClick={handleSign} disabled={isSigning}>
      {isSigning ? 'Signing...' : 'Sign Message'}
    </button>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ signMessage: (params) => Promise<SignedMessage | null>, isSigning: boolean, error: Error | null }'}</Code>
      </P>
      <P>
        <Code>{'SignedMessage'}</Code> includes: <Code>{'signature'}</Code>, <Code>{'partyId'}</Code>,
        {' '}<Code>{'message'}</Code>, <Code>{'nonce'}</Code>, <Code>{'domain'}</Code>.
      </P>

      <HR />

      <H3 id="use-sign-transaction">useSignTransaction</H3>
      <P>Sign a transaction without submitting it.</P>
      <CodeBlock language="tsx">{`import { useSignTransaction } from '@partylayer/react';

function SignTx() {
  const { signTransaction, isSigning, error } = useSignTransaction();

  const handleSign = async () => {
    const result = await signTransaction({
      tx: { templateId: '...', choiceId: '...', argument: { /* ... */ } },
    });

    if (result) {
      console.log('Transaction hash:', result.transactionHash);
      console.log('Signed payload:', result.signedTx);
    }
  };

  return <button onClick={handleSign}>{isSigning ? 'Signing...' : 'Sign Transaction'}</button>;
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ signTransaction: (params) => Promise<SignedTransaction | null>, isSigning: boolean, error: Error | null }'}</Code>
      </P>

      <HR />

      <H3 id="use-submit-transaction">useSubmitTransaction</H3>
      <P>Sign and submit a transaction to the ledger in one step.</P>
      <CodeBlock language="tsx">{`import { useSubmitTransaction } from '@partylayer/react';

function SubmitTx() {
  const { submitTransaction, isSubmitting, error } = useSubmitTransaction();

  const handleSubmit = async () => {
    const receipt = await submitTransaction({
      signedTx: signedPayload,  // Pass the signed transaction
    });

    if (receipt) {
      console.log('TX Hash:', receipt.transactionHash);
      console.log('Submitted at:', new Date(receipt.submittedAt));
      console.log('Command ID:', receipt.commandId);
    }
  };

  return <button onClick={handleSubmit}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>;
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ submitTransaction: (params) => Promise<TxReceipt | null>, isSubmitting: boolean, error: Error | null }'}</Code>
      </P>

      <HR />

      <H3 id="use-ledger-api">useLedgerApi</H3>
      <P>Call the Canton Ledger API through the connected wallet.</P>
      <CodeBlock language="tsx">{`import { useLedgerApi, useAccount } from '@partylayer/react';

function BalanceQuery() {
  const { isConnected, party } = useAccount();
  const { ledgerApi, isLoading, error } = useLedgerApi();

  const fetchBalance = async () => {
    if (!isConnected || !party) return;

    const result = await ledgerApi({
      requestMethod: 'POST',
      resource: '/v2/state/active-contracts',
      body: JSON.stringify({
        filter: {
          filtersByParty: {
            [party]: {
              inclusive: {
                templateFilters: [{ templateId: 'Splice.Amulet:Amulet' }],
              },
            },
          },
        },
      }),
    });

    if (result) {
      const { activeContracts = [] } = JSON.parse(result.response);
      console.log('Contracts:', activeContracts.length);
    }
  };

  return (
    <button onClick={fetchBalance} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Fetch Balance'}
    </button>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ ledgerApi: (params) => Promise<LedgerApiResult | null>, isLoading: boolean, error: Error | null }'}</Code>
      </P>
      <P>
        Requires a wallet with <Code>{'ledgerApi'}</Code> capability, see{' '}
        <A href="/docs/wallets#capability-matrix">Capability Matrix</A>. Throws{' '}
        <Code>{'CapabilityNotSupportedError'}</Code> for wallets that don{"'"}t support it (e.g. Cantor8).
      </P>

      {/* ── Utility Hooks ── */}
      <H2 id="utility-hooks">Utility Hooks</H2>

      <H3 id="use-registry-status">useRegistryStatus</H3>
      <P>Get the current wallet registry status and refresh it.</P>
      <CodeBlock language="tsx">{`import { useRegistryStatus } from '@partylayer/react';

function RegistryInfo() {
  const { status, refresh } = useRegistryStatus();

  if (!status) return <p>No registry data</p>;

  return (
    <div>
      <p>Source: {status.source}</p>
      <p>Verified: {status.verified ? 'Yes' : 'No'}</p>
      <p>Channel: {status.channel}</p>
      <p>Stale: {status.stale ? 'Yes' : 'No'}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'{ status: RegistryStatus | null, refresh: () => Promise<void> }'}</Code>
      </P>

      <HR />

      <H3 id="use-wallet-icons">useWalletIcons</H3>
      <P>Access the wallet icon overrides provided by <Code>{'PartyLayerKit'}</Code>.</P>
      <CodeBlock language="tsx">{`import { useWalletIcons, resolveWalletIcon } from '@partylayer/react';

function WalletIcon({ walletId, registryIcon }: { walletId: string; registryIcon?: string }) {
  const walletIcons = useWalletIcons();
  const iconUrl = resolveWalletIcon(walletId, walletIcons, registryIcon);

  if (!iconUrl) return <div className="fallback-icon" />;
  return <img src={iconUrl} alt={walletId} width={32} height={32} />;
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'Record<string, string>'}</Code>
      </P>

      <HR />

      <H3 id="use-theme">useTheme</H3>
      <P>Access the current PartyLayer theme.</P>
      <CodeBlock language="tsx">{`import { useTheme } from '@partylayer/react';

function ThemedComponent() {
  const theme = useTheme();

  return (
    <div style={{
      background: theme.colors.background,
      color: theme.colors.text,
      fontFamily: theme.fontFamily,
    }}>
      Current mode: {theme.mode}
    </div>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'PartyLayerTheme'}</Code>, see <A href="/docs/theming">Theming</A> for the full interface.
      </P>

      {/* ── Data hooks (/query) ── */}
      <H2 id="query-hooks">Data hooks (<Code>{'@partylayer/react/query'}</Code>)</H2>
      <P>
        v2 adds a TanStack Query powered entrypoint for reading and writing ledger data and for
        cost estimation. These hooks import from <Code>{'@partylayer/react/query'}</Code> and require a
        {' '}<Code>{'QueryClientProvider'}</Code> (see <A href="/docs/quick-start">Quick Start</A>).
        PartyLayer does not own ledger transport: you supply the fetcher, and the hook wraps it in
        {' '}<Code>{'useQuery'}</Code> / <Code>{'useMutation'}</Code>.
      </P>
      <Callout type="note" title="Requires QueryClientProvider">
        The hooks above (the main entrypoint) work without TanStack Query. The data hooks here need
        a <Code>{'QueryClient'}</Code> in context, so wrap your app in <Code>{'QueryClientProvider'}</Code>{' '}
        (in addition to <Code>{'PartyLayerKit'}</Code> / <Code>{'PartyLayerProvider'}</Code>). The entrypoint
        also exports query-backed variants of <Code>{'useConnect'}</Code>, <Code>{'useWallets'}</Code>,
        {' '}<Code>{'useDisconnect'}</Code>, <Code>{'useSignMessage'}</Code>, and <Code>{'useSubmitTransaction'}</Code>.
      </Callout>

      <H3 id="use-daml-contract">useDamlContract / useChoice (DAML, Model 2)</H3>
      <P>Read a contract (generic over its type) and exercise a choice. You supply the fetcher.</P>
      <CodeBlock language="tsx">{`import { useDamlContract, useChoice } from '@partylayer/react/query';

// read: you supply the \`read\` fetcher; null is a valid (absent) value, not an error.
const { contract, isLoading } = useDamlContract<MyContract>({ read: fetchContract });

// write: exposes exerciseChoice / exerciseChoiceAsync.
const { exerciseChoice, exerciseChoiceAsync } = useChoice<MyResult, MyVars>({ exercise });`}</CodeBlock>

      <H3 id="use-cost">useTransactionCostEstimate / usePaidTrafficCost (CIP-0104)</H3>
      <CodeBlock language="tsx">{`import { useTransactionCostEstimate, usePaidTrafficCost } from '@partylayer/react/query';

const { costEstimate } = useTransactionCostEstimate({ estimate: fetchEstimate });
const { paidTrafficCost } = usePaidTrafficCost({ fetch: fetchPaid });`}</CodeBlock>
      <P>
        <Code>{'useTransactionCostEstimate'}</Code> is the pre-submission <Code>{'CostEstimation'}</Code>;
        {' '}<Code>{'usePaidTrafficCost'}</Code> is the post-execution paid cost.
      </P>

      <H3 id="use-suspense">Suspense twins</H3>
      <P>
        The query hooks have <Code>{'useSuspense*'}</Code> twins (<Code>{'useSuspenseTransactionCostEstimate'}</Code>,
        {' '}<Code>{'useSuspensePaidTrafficCost'}</Code>, <Code>{'useSuspenseWallets'}</Code>) for declarative
        loading inside a React <Code>{'<Suspense>'}</Code> boundary: the value is always present (no loading
        flag), and the boundary shows the fallback while it resolves.
      </P>

      <H3 id="use-optimistic">Optimistic updates</H3>
      <P>
        <Code>{'optimisticMutationOptions'}</Code> wires an optimistic cache update with automatic rollback
        on error into <Code>{'useChoice'}</Code>. The <Code>{'partyLayerKeys'}</Code> factory (also exported
        here) produces the hierarchical cache keys, so manual cache reads/writes line up with the hooks.
        See the <A href="/docs/cookbook">Pattern Cookbook</A> for full recipes.
      </P>

      <PrevNext />
    </>
  );
}
