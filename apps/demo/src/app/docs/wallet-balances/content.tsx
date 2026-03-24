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

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI>Wallet connected — see <a href="/docs/quick-start" style={{ color: '#E6B800' }}>Quick Start</a></LI>
        <LI><Code>{'ledgerApi'}</Code> capability supported by the connected wallet (Console, Loop, and Cantor8 all support this)</LI>
      </UL>

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
      method: 'POST',
      path: '/v2/state/acs',
      body: {
        filter: {
          filtersByParty: {
            [session.partyId]: {
              inclusive: {
                templateFilters: [{ templateId }],
              },
            },
          },
        },
      },
    }).then((result) => {
      const total = (result.activeContracts ?? []).reduce(
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
            method: 'POST',
            path: '/v2/state/acs',
            body: {
              filter: {
                filtersByParty: {
                  [session.partyId]: {
                    inclusive: { templateFilters: [{ templateId }] },
                  },
                },
              },
            },
          })
          .then((result) => ({
            templateId,
            total: (result.activeContracts ?? []).reduce(
              (sum: number, c: any) =>
                sum + parseFloat(c.payload?.amount?.initialAmount ?? '0'),
              0
            ),
          }))
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
    method: 'POST',
    path: '/v2/state/acs',
    body: {
      filter: {
        filtersByParty: {
          [session.partyId]: {
            inclusive: {
              templateFilters: [{ templateId }],
            },
          },
        },
      },
    },
  });

  return (result.activeContracts ?? []).reduce(
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
  method: 'GET',
  path: '/v2/state/acs/active-contracts',
});

console.log(result.activeContracts);`}</CodeBlock>

      <H2 id="notes">Notes</H2>

      <H3>Template ID format</H3>
      <P>
        Template IDs follow the pattern <Code>{'Module.Name:EntityName'}</Code> — for example,{' '}
        <Code>{'Splice.Amulet:Amulet'}</Code>. These are defined in your Daml project. Check
        your Daml source or deployed package to find the exact values for your tokens.
      </P>

      <H3>ledgerApi availability</H3>
      <P>
        <Code>{'ledgerApi'}</Code> is only available on the native{' '}
        <Code>{'PartyLayerProvider'}</Code> path. Calling it on the legacy bridge path throws
        error <Code>{'4200'}</Code>. See{' '}
        <a href="/docs/cip-0103" style={{ color: '#E6B800' }}>CIP-0103 Provider</a> for details.
      </P>

      <H3>Paginated results</H3>
      <P>
        The ACS endpoint may paginate for parties with many contracts. Check{' '}
        <Code>{'result.nextPageToken'}</Code> and pass it as <Code>{'pageToken'}</Code> in
        subsequent requests to retrieve all pages.
      </P>

      <PrevNext />
    </>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 600 }}>{children}</strong>;
}
