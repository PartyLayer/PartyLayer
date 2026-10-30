import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectButton, PartyLayerKit, TokenBalances, useAccount, useClientSession } from '@partylayer/react';
import { useWalletTokenHoldings } from '@partylayer/react/query';

const queryClient = new QueryClient();

function WalletHoldings({ holdingInterfaceId }: { holdingInterfaceId: string }) {
  const { party, networkId } = useAccount();
  const session = useClientSession();
  const canRead = session?.capabilitiesSnapshot.includes('ledgerApi') === true;
  const query = useWalletTokenHoldings({
    networkId: 'canton:da-devnet', holdingInterfaceId,
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
  const holdingInterfaceId = import.meta.env.VITE_HOLDING_INTERFACE_ID;
  return <QueryClientProvider client={queryClient}>
    <PartyLayerKit network="devnet" appName="Canton holdings example">
      <main style={{ maxWidth: '720px', margin: '2rem auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Canton wallet holdings</h1>
        <p>Connect any supported wallet. Ledger access is required; balances use exact decimal strings and keep locked holdings separate.</p>
        {holdingInterfaceId ? <WalletHoldings holdingInterfaceId={holdingInterfaceId} /> : <>
          <ConnectButton />
          <p>Token holdings are not configured for this example. See the example README to enable reads.</p>
        </>}
      </main>
    </PartyLayerKit>
  </QueryClientProvider>;
}
