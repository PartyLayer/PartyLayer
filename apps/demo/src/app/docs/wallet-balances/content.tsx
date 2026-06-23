'use client';

import { useDocs } from '../layout';

export default function WalletBalancesContent() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, LI } = useDocs();

  return (
    <>
      <H1>Wallet Balances</H1>
      <P>
        PartyLayer does not have a dedicated <Code>{'getBalance()'}</Code> method. Token holdings
        on the Canton Network live as contracts in the{' '}
        <Strong>Active Contract Set (ACS)</Strong>, not as a single numeric value. You query the
        ACS for the party{"'"}s holding contracts, then sum the amounts.
      </P>

      <Callout type="note">
        Think of it like a UTXO model. A party{"'"}s balance for a given instrument is the sum of
        all active holding contracts they own for that instrument.
      </Callout>

      <Callout type="tip">
        See the full working example in{' '}
        <a href="https://github.com/PartyLayer/PartyLayer/tree/main/examples/wallet-balance-loop" style={{ color: '#E6B800' }}>
          examples/wallet-balance-loop/
        </a>
        , a minimal Vite + React + TypeScript app that connects Loop wallet, queries balance, and
        displays the result.
      </Callout>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI>Wallet connected, see <a href="/docs/quick-start" style={{ color: '#E6B800' }}>Quick Start</a></LI>
        <LI><Code>{'ledgerApi'}</Code> capability supported by the connected wallet (Console, Loop, Nightly, and Bron all support this)</LI>
      </UL>

      <Callout type="note">
        <Strong>Session persistence:</Strong> After a page reload the SDK automatically
        restores the active session from storage. Your component may mount{' '}
        <Code>{'isDisconnected'}</Code> (or <Code>{'reconnecting'}</Code>) for a moment while the
        restore runs, so always guard with <Code>{'if (!isConnected) return null'}</Code> or render a{' '}
        <Code>{'<ConnectButton />'}</Code> fallback. See{' '}
        <a href="/docs/advanced#session-persistence" style={{ color: '#E6B800' }}>Advanced, Session Persistence</a>{' '}
        for per-wallet behavior.
      </Callout>

      <H2 id="how-it-works">How the query works</H2>
      <P>
        A correct Canton JSON Ledger API active-contracts query has three parts. Getting any of them
        wrong returns an empty set.
      </P>
      <UL>
        <LI>
          <Strong>Read at an offset.</Strong> <Code>{'activeAtOffset'}</Code> is required. First call{' '}
          <Code>{'GET /v2/state/ledger-end'}</Code> to get the current <Code>{'offset'}</Code>.
        </LI>
        <LI>
          <Strong>Wrap the filter in <Code>{'eventFormat'}</Code>.</Strong> The filter lives under{' '}
          <Code>{'eventFormat.filtersByParty[party].cumulative[]'}</Code>. A bare{' '}
          <Code>{'filtersByParty'}</Code> object returns nothing.
        </LI>
        <LI>
          <Strong>Filter by the Token Standard Holding interface.</Strong> Use an{' '}
          <Code>{'InterfaceFilter'}</Code> on{' '}
          <Code>{'#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'}</Code> with{' '}
          <Code>{'includeInterfaceView: true'}</Code>, so every token holding comes back through one query.
        </LI>
      </UL>
      <P>
        Each returned entry is <Code>{'{ contractEntry: { JsActiveContract: { createdEvent } } }'}</Code>.
        The contract id is at <Code>{'createdEvent.contractId'}</Code>, and the Holding view (owner,
        instrumentId, amount, lock) is at <Code>{'createdEvent.interfaceViews[0].viewValue'}</Code>.
        There is no top-level <Code>{'payload'}</Code> field on an interface query.
      </P>

      <H2 id="react">React</H2>

      <H3>Single instrument balance</H3>
      <CodeBlock language="tsx">{`import { useState, useEffect } from 'react';
import { useAccount, usePartyLayer } from '@partylayer/react';

const HOLDING_INTERFACE =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding';

function TokenBalance({ instrumentId }: { instrumentId: string }) {
  const { isConnected, party } = useAccount();
  const client = usePartyLayer();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isConnected || !party) return;

    (async () => {
      // 1. activeAtOffset is required: read the current ledger end.
      const end = await client.ledgerApi({
        requestMethod: 'GET',
        resource: '/v2/state/ledger-end',
      });
      const { offset } = JSON.parse(end.response);

      // 2. Query holdings via the Token Standard Holding interface.
      const acs = await client.ledgerApi({
        requestMethod: 'POST',
        resource: '/v2/state/active-contracts',
        body: JSON.stringify({
          activeAtOffset: offset,
          eventFormat: {
            filtersByParty: {
              [party]: {
                cumulative: [
                  {
                    identifierFilter: {
                      InterfaceFilter: {
                        value: {
                          interfaceId: HOLDING_INTERFACE,
                          includeInterfaceView: true,
                        },
                      },
                    },
                  },
                ],
              },
            },
            verbose: false,
          },
        }),
      });

      // 3. Sum amounts from each Holding view, filtered to this instrument.
      const parsed = JSON.parse(acs.response);
      const entries = Array.isArray(parsed) ? parsed : parsed.activeContracts ?? [];
      const total = entries.reduce((sum: number, e: any) => {
        const view = e.contractEntry?.JsActiveContract?.createdEvent?.interfaceViews?.[0]?.viewValue;
        if (!view || view.instrumentId?.id !== instrumentId) return sum;
        return sum + parseFloat(view.amount ?? '0');
      }, 0);
      setBalance(total);
    })();
  }, [isConnected, party, client, instrumentId]);

  if (!isConnected) return null;
  return <span>{balance ?? '…'}</span>;
}

// Usage
<TokenBalance instrumentId="Amulet" />`}</CodeBlock>

      <Callout type="tip">
        <Strong>Prefer the dedicated hook:</Strong> The <Code>{'useLedgerApi'}</Code> hook provides
        built-in <Code>{'isLoading'}</Code> and <Code>{'error'}</Code> state, saving you from managing
        them manually. See <a href="/docs/hooks#use-ledger-api" style={{ color: '#E6B800' }}>React Hooks, useLedgerApi</a> for
        full documentation.
      </Callout>

      <H3>All holdings, grouped by instrument</H3>
      <P>
        The interface query returns every token holding in one call, so you can group by{' '}
        <Code>{'instrumentId'}</Code> instead of querying each instrument separately.
      </P>
      <CodeBlock language="tsx">{`import { useState, useEffect } from 'react';
import { useAccount, usePartyLayer } from '@partylayer/react';

const HOLDING_INTERFACE =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding';

function AllBalances() {
  const { isConnected, party } = useAccount();
  const client = usePartyLayer();
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isConnected || !party) return;

    (async () => {
      const end = await client.ledgerApi({
        requestMethod: 'GET',
        resource: '/v2/state/ledger-end',
      });
      const { offset } = JSON.parse(end.response);

      const acs = await client.ledgerApi({
        requestMethod: 'POST',
        resource: '/v2/state/active-contracts',
        body: JSON.stringify({
          activeAtOffset: offset,
          eventFormat: {
            filtersByParty: {
              [party]: {
                cumulative: [
                  {
                    identifierFilter: {
                      InterfaceFilter: {
                        value: { interfaceId: HOLDING_INTERFACE, includeInterfaceView: true },
                      },
                    },
                  },
                ],
              },
            },
            verbose: false,
          },
        }),
      });

      const parsed = JSON.parse(acs.response);
      const entries = Array.isArray(parsed) ? parsed : parsed.activeContracts ?? [];
      const byInstrument: Record<string, number> = {};
      for (const e of entries) {
        const view = e.contractEntry?.JsActiveContract?.createdEvent?.interfaceViews?.[0]?.viewValue;
        if (!view) continue;
        const id = view.instrumentId?.id ?? 'unknown';
        byInstrument[id] = (byInstrument[id] ?? 0) + parseFloat(view.amount ?? '0');
      }
      setBalances(byInstrument);
    })();
  }, [isConnected, party, client]);

  return (
    <ul>
      {Object.entries(balances).map(([instrument, amount]) => (
        <li key={instrument}>
          {instrument}: {amount}
        </li>
      ))}
    </ul>
  );
}`}</CodeBlock>

      <H2 id="vanilla-js">Vanilla JS</H2>

      <P>
        Factor the offset-then-query steps into a reusable helper that returns the parsed Holding
        views, then sum or group them however you like.
      </P>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const HOLDING_INTERFACE =
  '#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My App' },
});

const session = await client.connect();
const party = session.partyId;

// Returns every Holding view for the party.
async function getHoldings(): Promise<any[]> {
  const end = await client.ledgerApi({
    requestMethod: 'GET',
    resource: '/v2/state/ledger-end',
  });
  const { offset } = JSON.parse(end.response);

  const acs = await client.ledgerApi({
    requestMethod: 'POST',
    resource: '/v2/state/active-contracts',
    body: JSON.stringify({
      activeAtOffset: offset,
      eventFormat: {
        filtersByParty: {
          [party]: {
            cumulative: [
              {
                identifierFilter: {
                  InterfaceFilter: {
                    value: { interfaceId: HOLDING_INTERFACE, includeInterfaceView: true },
                  },
                },
              },
            ],
          },
        },
        verbose: false,
      },
    }),
  });

  const parsed = JSON.parse(acs.response);
  const entries = Array.isArray(parsed) ? parsed : parsed.activeContracts ?? [];
  return entries
    .map((e: any) => e.contractEntry?.JsActiveContract?.createdEvent?.interfaceViews?.[0]?.viewValue)
    .filter(Boolean);
}

// Balance for one instrument.
async function getBalance(instrumentId: string): Promise<number> {
  const holdings = await getHoldings();
  return holdings
    .filter((v) => v.instrumentId?.id === instrumentId)
    .reduce((sum, v) => sum + parseFloat(v.amount ?? '0'), 0);
}

const balance = await getBalance('Amulet');
console.log('Balance:', balance);`}</CodeBlock>

      <H2 id="notes">Notes</H2>

      <H3>Interface ID vs template ID</H3>
      <P>
        Querying by the Token Standard <Code>{'Holding'}</Code> interface returns holdings for every
        instrument in one call, which is the recommended approach. The interface id is the
        fully-qualified Daml form with the package-name prefix:{' '}
        <Code>{'#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'}</Code>. If you need a
        specific template instead, replace the <Code>{'InterfaceFilter'}</Code> with a{' '}
        <Code>{'TemplateFilter'}</Code> whose <Code>{'value.templateId'}</Code> is the fully-qualified
        template id (for example <Code>{'#splice-amulet:Splice.Amulet:Amulet'}</Code>); a template
        query exposes the contract under <Code>{'createdEvent.createArgument'}</Code> rather than{' '}
        <Code>{'interfaceViews'}</Code>.
      </P>

      <H3>Response parsing</H3>
      <P>
        <Code>{'ledgerApi'}</Code> returns <Code>{'{ response: string }'}</Code>, a raw JSON
        payload from the Canton Ledger API. Parse it with{' '}
        <Code>{'JSON.parse(result.response)'}</Code>. The active-contracts response is the list of
        entries (some wallet proxies wrap it as <Code>{'{ activeContracts }'}</Code>, so the examples
        above normalize both with <Code>{'Array.isArray(parsed) ? parsed : parsed.activeContracts'}</Code>).
        Each entry exposes its created event at{' '}
        <Code>{'contractEntry.JsActiveContract.createdEvent'}</Code>.
      </P>

      <H3>Wallet support</H3>
      <P>
        Console, Nightly, and Bron provide full <Code>{'ledgerApi'}</Code> proxy access to the
        Canton Ledger API endpoints, including <Code>{'GET /v2/state/ledger-end'}</Code> and{' '}
        <Code>{'POST /v2/state/active-contracts'}</Code>. Loop exposes a higher-level{' '}
        <Code>{'provider.getActiveContracts({ templateId | interfaceId })'}</Code> and routes a{' '}
        <Code>{'/v2/state/acs'}</Code> alias through its own SDK; that alias is Loop-specific, not the
        generic Canton endpoint, so prefer <Code>{'getActiveContracts'}</Code> when targeting Loop
        directly. Cantor8 (mobile deep link) does not support <Code>{'ledgerApi'}</Code>; calling it
        with a Cantor8 session throws <Code>{'CapabilityNotSupportedError'}</Code>.
      </P>
      <Callout type="note">
        <Strong>Loop note:</Strong> Loop expects the fully-qualified Daml id with the{' '}
        <Code>{'#package-name:'}</Code> prefix for both template and interface filters, and it always
        filters by template or interface (it does not serve a bare unfiltered ACS read). Pass the same{' '}
        <Code>{'HOLDING_INTERFACE'}</Code> id shown above.
      </Callout>

      <H3>Large result sets</H3>
      <P>
        The active-contracts response is the full snapshot at the <Code>{'activeAtOffset'}</Code> you
        requested. Read the offset once with <Code>{'GET /v2/state/ledger-end'}</Code> and reuse it for
        every query in the same pass so all reads are consistent at the same point in ledger history.
      </P>

      <PrevNext />
    </>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 600 }}>{children}</strong>;
}
