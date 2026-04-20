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
        <Strong>Active Contract Set (ACS)</Strong> — not as a single numeric value. You query
        the ACS, then sum the amounts across all holding contracts.
      </P>

      <Callout type="note">
        Think of it like a UTXO model. A party{"'"}s balance for a given token is the sum of all
        active holding contracts they own for that token template.
      </Callout>

      <Callout type="tip">
        See the full working example in{' '}
        <a href="https://github.com/anthropics/PartyLayer/tree/main/examples/wallet-balance-loop" style={{ color: '#E6B800' }}>
          examples/wallet-balance-loop/
        </a>{' '}
        — a minimal Vite + React + TypeScript app that connects Loop wallet, queries
        balance, and displays the result.
      </Callout>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI>Wallet connected — see <a href="/docs/quick-start" style={{ color: '#E6B800' }}>Quick Start</a></LI>
        <LI><Code>{'ledgerApi'}</Code> capability supported by the connected wallet (Console, Loop, Nightly, and Bron all support this)</LI>
      </UL>

      <Callout type="note">
        <Strong>Session persistence:</Strong> After a page reload the SDK automatically
        restores the active session from storage. Your component may mount with{' '}
        <Code>{'session === null'}</Code> for a moment while the restore runs — always
        guard with <Code>{'if (!session) return null'}</Code> or render a{' '}
        <Code>{'<ConnectButton />'}</Code> fallback. See{' '}
        <a href="/docs/advanced#session-persistence" style={{ color: '#E6B800' }}>Advanced → Session Persistence</a>{' '}
        for per-wallet behavior.
      </Callout>

      <H2 id="react">React</H2>

      <H3>Single token balance</H3>
      <CodeBlock language="tsx">{`import { useState, useEffect } from 'react';
import { useSession, usePartyLayer } from '@partylayer/react';

function TokenBalance({ templateId }: { templateId: string }) {
  const session = useSession();
  const client = usePartyLayer();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;

    client.ledgerApi({
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
    }).then((result) => {
      const { activeContracts = [] } = JSON.parse(result.response);
      const total = activeContracts.reduce(
        (sum: number, c: any) =>
          sum + parseFloat(c.payload?.amount?.initialAmount ?? '0'),
        0
      );
      setBalance(total);
    });
  }, [session, templateId]);

  if (!session) return null;
  return <span>{balance ?? '…'}</span>;
}

// Usage
<TokenBalance templateId="Splice.Amulet:Amulet" />`}</CodeBlock>

      <Callout type="tip">
        <Strong>Prefer the dedicated hook:</Strong> The <Code>{'useLedgerApi'}</Code> hook provides
        built-in <Code>{'isLoading'}</Code> and <Code>{'error'}</Code> state, saving you from managing
        them manually. See <a href="/docs/hooks#use-ledger-api" style={{ color: '#E6B800' }}>React Hooks &rarr; useLedgerApi</a> for
        full documentation.
      </Callout>

      <H3>Single token balance with useLedgerApi</H3>
      <CodeBlock language="tsx">{`import { useState } from 'react';
import { useSession, useLedgerApi } from '@partylayer/react';

function TokenBalance({ templateId }: { templateId: string }) {
  const session = useSession();
  const { ledgerApi, isLoading, error } = useLedgerApi();
  const [balance, setBalance] = useState<number | null>(null);

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
                templateFilters: [{ templateId }],
              },
            },
          },
        },
      }),
    });

    if (result) {
      const { activeContracts = [] } = JSON.parse(result.response);
      const total = activeContracts.reduce(
        (sum: number, c: any) =>
          sum + parseFloat(c.payload?.amount?.initialAmount ?? '0'),
        0
      );
      setBalance(total);
    }
  };

  if (!session) return null;

  return (
    <div>
      <button onClick={fetchBalance} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Fetch Balance'}
      </button>
      {error && <p>Error: {error.message}</p>}
      {balance !== null && <span>Balance: {balance}</span>}
    </div>
  );
}`}</CodeBlock>

      <H3>Multiple tokens in parallel</H3>
      <CodeBlock language="tsx">{`import { useState, useEffect } from 'react';
import { useSession, usePartyLayer } from '@partylayer/react';

const TOKEN_TEMPLATES = [
  'Splice.Amulet:Amulet',
  'YourProject.Token:Token',
];

function MultiTokenBalances() {
  const session = useSession();
  const client = usePartyLayer();
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!session) return;

    Promise.all(
      TOKEN_TEMPLATES.map((templateId) =>
        client
          .ledgerApi({
            requestMethod: 'POST',
            resource: '/v2/state/acs',
            body: JSON.stringify({
              filter: {
                filtersByParty: {
                  [session.partyId]: {
                    inclusive: { templateFilters: [{ templateId }] },
                  },
                },
              },
            }),
          })
          .then((result) => {
            const { activeContracts = [] } = JSON.parse(result.response);
            return {
              templateId,
              total: activeContracts.reduce(
                (sum: number, c: any) =>
                  sum + parseFloat(c.payload?.amount?.initialAmount ?? '0'),
                0
              ),
            };
          })
      )
    ).then((results) => {
      setBalances(
        Object.fromEntries(results.map((r) => [r.templateId, r.total]))
      );
    });
  }, [session]);

  return (
    <ul>
      {Object.entries(balances).map(([template, amount]) => (
        <li key={template}>
          {template}: {amount}
        </li>
      ))}
    </ul>
  );
}`}</CodeBlock>

      <H2 id="vanilla-js">Vanilla JS</H2>

      <H3>Single token</H3>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My App' },
});

const session = await client.connect();

async function getBalance(templateId: string): Promise<number> {
  const result = await client.ledgerApi({
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

  const { activeContracts = [] } = JSON.parse(result.response);
  return activeContracts.reduce(
    (sum: number, c: any) =>
      sum + parseFloat(c.payload?.amount?.initialAmount ?? '0'),
    0
  );
}

const balance = await getBalance('Splice.Amulet:Amulet');
console.log('Balance:', balance);`}</CodeBlock>

      <H3>All holdings (unfiltered)</H3>
      <P>Fetch every active contract for the connected party, regardless of token type:</P>
      <CodeBlock language="typescript">{`const result = await client.ledgerApi({
  requestMethod: 'GET',
  resource: '/v2/state/acs/active-contracts',
});

const { activeContracts } = JSON.parse(result.response);
console.log(activeContracts);`}</CodeBlock>

      <H2 id="notes">Notes</H2>

      <H3>Template ID format</H3>
      <P>
        Template IDs follow the pattern <Code>{'Module.Name:EntityName'}</Code> where{' '}
        <Code>{'Module.Name'}</Code> is the fully qualified Daml module and{' '}
        <Code>{'EntityName'}</Code> is the template name within that module.
      </P>

      <Callout type="note">
        <Strong>Loop wallet requires fully-qualified template IDs.</Strong> The Loop SDK
        expects the Daml package name prefix (e.g.,{' '}
        <Code>{'#splice-amulet:Splice.Amulet:Amulet'}</Code>), not the short Canton
        format (<Code>{'Splice.Amulet:Amulet'}</Code>). Console and Nightly wallets accept
        both formats. If you get errors querying with Loop, check that your template IDs
        include the <Code>{'#package-name:'}</Code> prefix.
      </Callout>

      <P>Common examples on the Canton Network:</P>
      <UL>
        <LI><Code>{'#splice-amulet:Splice.Amulet:Amulet'}</Code> — the native Splice Amulet token (Loop format)</LI>
        <LI><Code>{'#splice-amulet:Splice.Amulet:LockedAmulet'}</Code> — locked (vesting) Amulet holdings (Loop format)</LI>
        <LI><Code>{'Splice.Amulet:Amulet'}</Code> — short format (Console / Nightly only)</LI>
      </UL>
      <P>
        To find template IDs for your project, check your Daml source files (<Code>{'.daml'}</Code>),
        your deployed package metadata, or the Canton Network ecosystem documentation.
      </P>

      <H3>Response parsing</H3>
      <P>
        <Code>{'ledgerApi'}</Code> returns <Code>{'{ response: string }'}</Code> — a raw JSON
        string from the Canton Ledger API. Always parse it with{' '}
        <Code>{'JSON.parse(result.response)'}</Code> before accessing fields like{' '}
        <Code>{'activeContracts'}</Code>.
      </P>

      <H3>Wallet support</H3>
      <P>
        Console, Nightly, and Bron provide full <Code>{'ledgerApi'}</Code> proxy access to all
        Canton Ledger API endpoints. Loop supports <Code>{'POST /v2/state/acs'}</Code> (filtered
        queries) and <Code>{'POST /v2/commands/submit[-and-wait]'}</Code> via its native SDK
        methods — this covers wallet balance queries and command submission. Cantor8 (mobile
        deep link) does not support <Code>{'ledgerApi'}</Code> — calling it with a Cantor8
        session throws <Code>{'CapabilityNotSupportedError'}</Code>.
      </P>
      <Callout type="note">
        <Strong>Loop limitations:</Strong> The <Code>{'GET /v2/state/acs/active-contracts'}</Code>{' '}
        unfiltered endpoint may not be supported by Loop{"'"}s backend. Always provide a{' '}
        <Code>{'templateId'}</Code> or <Code>{'interfaceId'}</Code> filter when using Loop wallet.
        Use the fully-qualified template ID format with the <Code>{'#package-name:'}</Code> prefix.
      </Callout>

      <H3>Paginated results</H3>
      <P>
        The ACS endpoint may paginate for parties with many contracts. Check{' '}
        <Code>{'nextPageToken'}</Code> in the parsed response and pass it as{' '}
        <Code>{'pageToken'}</Code> in subsequent requests to retrieve all pages.
      </P>
      <CodeBlock language="typescript">{`async function getAllContracts(
  client: PartyLayerClient,
  partyId: string,
  templateId: string,
): Promise<any[]> {
  const allContracts: any[] = [];
  let pageToken: string | undefined;

  do {
    const result = await client.ledgerApi({
      requestMethod: 'POST',
      resource: '/v2/state/acs',
      body: JSON.stringify({
        filter: {
          filtersByParty: {
            [partyId]: {
              inclusive: {
                templateFilters: [{ templateId }],
              },
            },
          },
        },
        pageToken,
      }),
    });

    const parsed = JSON.parse(result.response);
    allContracts.push(...(parsed.activeContracts ?? []));
    pageToken = parsed.nextPageToken;
  } while (pageToken);

  return allContracts;
}`}</CodeBlock>

      <PrevNext />
    </>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 600 }}>{children}</strong>;
}
