import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectButton, PartyLayerKit, TokenBalances, useAccount, useClientSession, usePartyLayer } from '@partylayer/react';
import { useTokenHoldings } from '@partylayer/react/query';
import { readWalletHoldings } from './holdings';

const queryClient = new QueryClient();

function WalletHoldings() {
  const { party, networkId } = useAccount();
  const session = useClientSession();
  const client = usePartyLayer();
  const canRead = session?.capabilitiesSnapshot.includes('ledgerApi') === true;
  const query = useTokenHoldings({
    key: [session?.walletId, party, networkId],
    read: signal => readWalletHoldings(client, party!, signal),
    query: { enabled: !!party && !!networkId && canRead },
  });
  const error = canRead ? query.error : new Error('This wallet does not expose ledger reads. Use an authorized application backend.');
  const holdings = party && networkId ? {
    partyId: party, networkId, holdings: query.holdings ?? [], loading: query.isFetching, error,
  } : undefined;
  return <>
    <ConnectButton holdings={holdings} />
    {party && <TokenBalances owner={party} holdings={query.holdings ?? []} loading={query.isFetching} error={error} />}
    {party && canRead && <button type="button" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>Refresh holdings</button>}
  </>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}>
    <PartyLayerKit network="devnet" appName="Canton holdings example">
      <main style={{ maxWidth: '720px', margin: '2rem auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Canton wallet holdings</h1>
        <p>Connect any supported wallet. Ledger access is required; balances use exact decimal strings and keep locked holdings separate.</p>
        <WalletHoldings />
      </main>
    </PartyLayerKit>
  </QueryClientProvider>;
}
