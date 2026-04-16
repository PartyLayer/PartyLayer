'use client';

import { useDocs } from '../layout';

export default function HooksPage() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, A, Strong, HR } = useDocs();

  return (
    <>
      <H1>React Hooks</H1>
      <P>
        PartyLayer provides 12 React hooks for accessing wallet state, performing operations,
        and managing sessions. All hooks must be used within a <Code>{'PartyLayerKit'}</Code> or
        {' '}<Code>{'PartyLayerProvider'}</Code>.
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
        Get the active wallet session. Returns <Code>{'null'}</Code> when disconnected.
        Automatically updates when the session changes.
      </P>
      <CodeBlock language="tsx">{`import { useSession } from '@partylayer/react';

function Profile() {
  const session = useSession();

  if (!session) return <p>Not connected</p>;

  return (
    <div>
      <p>Party ID: {session.partyId}</p>
      <p>Wallet: {session.walletId}</p>
      <p>Network: {session.network}</p>
      <p>Capabilities: {session.capabilitiesSnapshot.join(', ')}</p>
    </div>
  );
}`}</CodeBlock>
      <P>
        <Strong>Return type:</Strong> <Code>{'Session | null'}</Code>
      </P>
      <P>
        The <Code>{'Session'}</Code> object includes: <Code>{'sessionId'}</Code>, <Code>{'walletId'}</Code>,
        {' '}<Code>{'partyId'}</Code>, <Code>{'network'}</Code>, <Code>{'createdAt'}</Code>,
        {' '}<Code>{'expiresAt'}</Code>, <Code>{'origin'}</Code>, <Code>{'capabilitiesSnapshot'}</Code>, <Code>{'metadata'}</Code>.
      </P>

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
          {w.name} — {w.capabilities.join(', ')}
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
        The <Code>{'options'}</Code> parameter accepts: <Code>{'walletId'}</Code> (optional — if omitted, opens the modal).
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
      <CodeBlock language="tsx">{`import { useLedgerApi, useSession } from '@partylayer/react';

function BalanceQuery() {
  const session = useSession();
  const { ledgerApi, isLoading, error } = useLedgerApi();

  const fetchBalance = async () => {
    if (!session) return;

    const result = await ledgerApi({
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
        Requires a wallet with <Code>{'ledgerApi'}</Code> capability — see{' '}
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
        <Strong>Return type:</Strong> <Code>{'PartyLayerTheme'}</Code> — see <A href="/docs/theming">Theming</A> for the full interface.
      </P>

      <PrevNext />
    </>
  );
}
