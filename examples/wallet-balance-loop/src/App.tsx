import { useEffect, useState } from 'react';
import { PartyLayerProvider, useSession, useConnect, useDisconnect, useLedgerApi } from '@partylayer/react';
import { createPartyLayer } from '@partylayer/sdk';
import type { PartyLayerClient } from '@partylayer/sdk';

/**
 * Minimal example: query wallet balance via Loop wallet.
 *
 * Loop wallet requires fully-qualified Daml template IDs with the
 * package name prefix, e.g. '#splice-amulet:Splice.Amulet:Amulet'.
 */

// Default template ID — use the Loop-compatible fully-qualified format
const DEFAULT_TEMPLATE_ID = '#splice-amulet:Splice.Amulet:Amulet';

function WalletBalance() {
  const session = useSession();
  const { connect, isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { ledgerApi, isLoading, error } = useLedgerApi();

  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [balance, setBalance] = useState<number | null>(null);
  const [contracts, setContracts] = useState<unknown[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!session) return;
    setBalance(null);
    setContracts([]);
    setRawResponse(null);

    const result = await ledgerApi({
      requestMethod: 'POST',
      resource: '/v2/state/acs',
      body: JSON.stringify({
        filter: {
          filtersByParty: {
            [session.partyId]: {
              inclusive: {
                templateFilters: [{ templateId }],
              },
            },
          },
        },
      }),
    });

    if (result) {
      setRawResponse(result.response);
      const { activeContracts = [] } = JSON.parse(result.response);
      setContracts(activeContracts);
      const total = activeContracts.reduce(
        (sum: number, c: { payload?: { amount?: { initialAmount?: string } } }) =>
          sum + parseFloat(c.payload?.amount?.initialAmount ?? '0'),
        0,
      );
      setBalance(total);
    }
  };

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h2>Connect your Loop wallet</h2>
        <button
          onClick={() => connect({ walletId: 'loop' as never })}
          disabled={isConnecting}
          style={buttonStyle}
        >
          {isConnecting ? 'Connecting...' : 'Connect Loop Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <strong>Party ID:</strong> <code>{session.partyId}</code>
        </div>
        <button onClick={() => disconnect()} style={buttonStyle}>
          Disconnect
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Template ID:{' '}
          <input
            type="text"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            style={{ width: '400px', fontFamily: 'monospace', padding: '4px' }}
          />
        </label>
      </div>

      <button onClick={fetchBalance} disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Querying...' : 'Fetch Balance'}
      </button>

      {error && (
        <div style={{ color: '#e53e3e', marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {balance !== null && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Balance: {balance}</h3>
          <p>{contracts.length} active contract(s)</p>
        </div>
      )}

      {rawResponse && (
        <details style={{ marginTop: '1rem' }}>
          <summary>Raw response</summary>
          <pre style={{ background: '#1a1a2e', color: '#eee', padding: '1rem', borderRadius: '4px', overflow: 'auto', maxHeight: '400px' }}>
            {JSON.stringify(JSON.parse(rawResponse), null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  background: '#4a90d9',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
};

function App() {
  const [client, setClient] = useState<PartyLayerClient | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const c = createPartyLayer({
      network: 'mainnet',
      app: { name: 'Wallet Balance Example' },
    });
    setClient(c);
    return () => c.destroy();
  }, []);

  if (!client) return <div>Initializing...</div>;

  return (
    <PartyLayerProvider client={client}>
      <div style={{ maxWidth: '720px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Wallet Balance — Loop Example</h1>
        <p style={{ color: '#888' }}>
          Connects to Loop wallet, queries ACS for a specific template, and sums the balance.
        </p>
        <WalletBalance />
      </div>
    </PartyLayerProvider>
  );
}

export default App;
