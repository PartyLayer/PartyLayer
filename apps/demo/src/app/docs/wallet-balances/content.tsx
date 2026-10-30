'use client';

import { useDocs } from '../layout';

export default function WalletBalancesContent() {
  const { H1, H2, P, CodeBlock, Callout, A } = useDocs();
  return <>
    <H1>Wallet balances</H1>
    <P>Canton holdings are private contracts. Read them through your authorized application backend
      or a wallet that supports ledgerApi, then pass the typed result to the standard account
      panel. PartyLayer does not invent a public balance endpoint or silently count an unavailable
      read as a zero balance.</P>
    <H2 id="prerequisites">Prerequisites</H2>
    <P>Connect a wallet on the intended network. The application read must be authorized for the
      current party/network and return TokenHoldingRef records: a contract id (cid) paired with
      its Holding view (owner, instrumentId, amount and optional lock). A wallet proxy additionally
      requires the actual ledgerApi capability. These reads never transfer funds.</P>
    <H2 id="how-it-works">How the query works</H2>
    <P>Use a consistent active-contract snapshot at a valid ledger offset and the Holding interface
      from your deployed Token Standard. Request interface views, read every page, and map each
      contract id and view into a typed holding. Inspect the deployed API version; streaming and
      paginated endpoint request/response shapes differ. A partial page is not a complete balance.</P>
    <P>The <A href="https://docs.digitalasset.com/build/3.4/reference/json-api/openapi.html">JSON Ledger API reference</A>
      documents activeAtOffset, eventFormat and interface filters. The updated
      <A href="https://github.com/PartyLayer/PartyLayer/tree/main/examples/wallet-balance-loop">wallet holdings example</A>
      demonstrates a read-only v2 wallet proxy: ledger-end followed by active-contracts,
      exact Holding views, safe offset validation and rejection of unexpected pagination.
      It uses the public default wallet catalog and requires a compatible wallet/ledger deployment;
      it is not a claim that every live wallet read has passed.</P>
    <H2 id="react">React</H2>
    <P>Starting with SDK 0.21.0 / React 3.2.0, <code>useWalletTokenHoldings</code> is the ready alternative for compatible v2 wallet proxies. It scopes the
      cache and validates complete snapshots; the application-fetcher hook below remains available.
      See the <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/wallet-ledger-reader.md">reader guide</A>.</P>
    <P>The same hook also accepts an explicit application endpoint/source configuration when
      a wallet has no ledger proxy. The <A href="https://github.com/PartyLayer/PartyLayer/tree/main/examples/authentication-server">server reference</A>
      authorizes those reads with its own app session and rebuilds party-scoped filters;
      participant credentials stay server-side.</P>
    <CodeBlock language="tsx">{`import { ConnectButton, useAccount } from '@partylayer/react';
import { useTokenHoldings } from '@partylayer/react/query';
import type { TokenHoldingRef } from '@partylayer/react/query';

function AccountButton() {
  const { party, networkId, isConnected } = useAccount();
  const holdings = useTokenHoldings({
    key: [party, networkId],
    read: async (signal): Promise<TokenHoldingRef[]> => {
      // Your backend authenticates and authorizes the requested party/network.
      const response = await fetch('/api/holdings', {
        method: 'POST', credentials: 'same-origin', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId: party, networkId }),
      });
      if (!response.ok) throw new Error('Holdings unavailable');
      return response.json(); // Backend validates/maps the Holding interface schema.
    },
    query: { enabled: isConnected && !!party && !!networkId },
  });
  return <ConnectButton holdings={party && networkId ? {
    partyId: party, networkId, holdings: holdings.holdings ?? [],
    loading: holdings.isPending || holdings.isFetching, error: holdings.error,
  } : undefined} />;
}`}</CodeBlock>
    <P>The ready-made account panel displays supplied holdings only when party and CAIP-2 network
      exactly match its active session. Previous-account data is hidden. Loading/errors are
      explicit. Custom views can render TokenBalances with owner, holdings, loading and error;
      formatInstrument receives both instrument admin and id.</P>
    <CodeBlock language="tsx">{`import { TokenBalances } from '@partylayer/react';
import { summarizeTokenHoldings } from '@partylayer/react/query';

const balances = summarizeTokenHoldings(holdings, partyId);
// { owner, instrumentId: { admin, id }, total, available, locked, holdingCount }[]
// total/available/locked are exact decimal strings.
<TokenBalances owner={partyId} holdings={holdings} />`}</CodeBlock>
    <H2 id="vanilla">Vanilla JavaScript</H2>
    <P>The existing core package exposes a framework-free decimal helper. Declare core directly
      in a separate backend/vanilla package rather than relying on a hoisted transitive dependency.</P>
    <CodeBlock language="ts">{`import { sumTokenAmounts } from '@partylayer/core/amounts';

// Use only owner-filtered holdings for the SAME instrument admin AND id.
const total = sumTokenAmounts(['9007199254740993.1', '0.2']);
// '9007199254740993.3' — no conversion to Number/parseFloat.`}</CodeBlock>
    <H2 id="notes">Notes</H2>
    <Callout type="warning">Keep token amounts as decimal strings. Group by both instrument admin
      and id; two issuers may use the same token name. Never sum with parseFloat, Number or a
      floating-point reducer. Duplicate contract ids and malformed/negative amounts are rejected.</Callout>
    <P>Reported locks remain locked in the summary, even if their timestamp is in the past. Only
      an updated ledger view establishes that a lock was removed. These totals cover returned
      active holdings, not incomplete assignments, pending transfers, a proof of spendability or
      full historical activity. Backend authorization, complete reads and final live-wallet
      acceptance remain required.</P>
  </>;
}
