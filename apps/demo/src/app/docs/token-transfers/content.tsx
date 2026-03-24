'use client';

import { useDocs } from '../layout';

export default function TokenTransfersContent() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, LI } = useDocs();

  return (
    <>
      <H1>Token Transfers</H1>
      <P>
        PartyLayer does not have a dedicated <Code>{'transfer()'}</Code> method. Transfers on the
        Canton Network are <Strong>Daml commands</Strong> — you construct the command payload and
        submit it through the wallet. The SDK handles signing, submission, and status tracking.
      </P>

      <Callout type="note">
        Before transferring, you need the <Code>{'contractId'}</Code> of the holding you want to
        spend. Fetch it from the ACS first — see{' '}
        <a href="/docs/wallet-balances" style={{ color: '#E6B800' }}>Wallet Balances</a>.
      </Callout>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI>Wallet connected — see <a href="/docs/quick-start" style={{ color: '#E6B800' }}>Quick Start</a></LI>
        <LI>The Daml template ID and contract ID of the holding to spend</LI>
        <LI><Code>{'signTransaction'}</Code> and <Code>{'submitTransaction'}</Code> capabilities (supported by all built-in wallets)</LI>
      </UL>

      <H2 id="react">React</H2>

      <CodeBlock language="tsx">{`import { useSession, useSignTransaction, useSubmitTransaction } from '@partylayer/react';

function TransferButton({ receiverPartyId }: { receiverPartyId: string }) {
  const session = useSession();
  const { signTransaction, isSigning } = useSignTransaction();
  const { submitTransaction, isSubmitting } = useSubmitTransaction();

  const handleTransfer = async () => {
    if (!session) return;

    // Build the Daml command payload.
    // Replace templateId, contractId, and choiceArgument with your own Daml values.
    const payload = {
      commands: [
        {
          exerciseCommand: {
            templateId: 'Splice.Amulet:Amulet',
            contractId: '<holding-contract-id>',
            choice: 'Amulet_Transfer',
            choiceArgument: {
              transfer: {
                sender: session.partyId,
                provider: '<provider-party-id>',
                inputs: [{ inputAmulet: { contractId: '<holding-contract-id>' } }],
                outputs: [
                  {
                    receiver: receiverPartyId,
                    amount: '10.0',
                    receiverFeeRatio: '0.0',
                  },
                ],
              },
            },
          },
        },
      ],
      commandId: crypto.randomUUID(),
      applicationId: 'my-app',
      actAs: [session.partyId],
      readAs: [],
    };

    const signed = await signTransaction({ tx: payload });
    if (!signed) return;

    const receipt = await submitTransaction({ signedTx: signed.signedTx });

    console.log('Transfer submitted:', receipt?.transactionHash);
  };

  const isLoading = isSigning || isSubmitting;

  return (
    <button onClick={handleTransfer} disabled={isLoading}>
      {isSigning ? 'Waiting for wallet…' : isSubmitting ? 'Submitting…' : 'Transfer'}
    </button>
  );
}`}</CodeBlock>

      <H3>Listen for status updates</H3>
      <CodeBlock language="tsx">{`import { useEffect } from 'react';
import { usePartyLayer } from '@partylayer/react';

function useTxStatus(onUpdate: (status: string, hash: string) => void) {
  const client = usePartyLayer();

  useEffect(() => {
    return client.on('tx:status', (event) => {
      onUpdate(event.status, event.transactionHash);
    });
  }, [client, onUpdate]);
}

// Status transitions: pending → submitted → committed (or rejected / failed)`}</CodeBlock>

      <H2 id="vanilla-js">Vanilla JS</H2>

      <H3>Sign and submit</H3>
      <CodeBlock language="typescript">{`import { createPartyLayer } from '@partylayer/sdk';

const client = createPartyLayer({
  network: 'mainnet',
  app: { name: 'My App' },
});

const session = await client.connect();

const payload = {
  commands: [
    {
      exerciseCommand: {
        templateId: 'Splice.Amulet:Amulet',
        contractId: '<holding-contract-id>',
        choice: 'Amulet_Transfer',
        choiceArgument: {
          transfer: {
            sender: session.partyId,
            provider: '<provider-party-id>',
            inputs: [{ inputAmulet: { contractId: '<holding-contract-id>' } }],
            outputs: [
              {
                receiver: '<receiver-party-id>',
                amount: '10.0',
                receiverFeeRatio: '0.0',
              },
            ],
          },
        },
      },
    },
  ],
  commandId: crypto.randomUUID(),
  applicationId: 'my-app',
  actAs: [session.partyId],
  readAs: [],
};

// Step 1 — Sign (wallet prompts user for approval)
const signed = await client.signTransaction({ tx: payload });

// Step 2 — Submit
const receipt = await client.submitTransaction({ signedTx: signed.signedTx });

// receipt: { transactionHash, submittedAt, commandId, updateId }
console.log('Transaction hash:', receipt.transactionHash);

// Step 3 — Listen for status
client.on('tx:status', (event) => {
  console.log(event.status, event.transactionHash);
  // pending → submitted → committed (or rejected / failed)
});`}</CodeBlock>

      <H3>Submit directly via ledgerApi</H3>
      <P>
        Skip the separate sign step and submit in one call. Use this when the wallet handles
        signing internally (Console, Loop, Nightly, or Bron).
      </P>
      <CodeBlock language="typescript">{`const result = await client.ledgerApi({
  requestMethod: 'POST',
  resource: '/v2/commands/submit-and-wait',
  body: JSON.stringify(payload),
});`}</CodeBlock>

      <H2 id="error-handling">Error Handling</H2>
      <CodeBlock language="typescript">{`import {
  UserRejectedError,
  SessionExpiredError,
  CapabilityNotSupportedError,
} from '@partylayer/sdk';

try {
  const signed = await client.signTransaction({ tx: payload });
  const receipt = await client.submitTransaction({ signedTx: signed.signedTx });
} catch (err) {
  if (err instanceof UserRejectedError) {
    // User declined in the wallet — safe to retry
  } else if (err instanceof SessionExpiredError) {
    await client.connect();
    // Retry transfer
  } else if (err instanceof CapabilityNotSupportedError) {
    // Wallet does not support signTransaction (e.g. Loop, Nightly)
    // Use submitTransaction directly instead
  }
}`}</CodeBlock>
      <P>
        See <a href="/docs/error-handling" style={{ color: '#E6B800' }}>Error Handling</a> for the
        full list of error types.
      </P>

      <H2 id="notes">Notes</H2>

      <H3>Payload structure</H3>
      <P>
        The examples above use <Code>{'Splice.Amulet:Amulet'}</Code> as the template. Replace{' '}
        <Code>{'templateId'}</Code>, <Code>{'contractId'}</Code>, <Code>{'choice'}</Code>, and{' '}
        <Code>{'choiceArgument'}</Code> with the values from your own Daml templates.
      </P>

      <H3>commandId uniqueness</H3>
      <P>
        Always generate a fresh <Code>{'commandId'}</Code> per submission — for example,{' '}
        <Code>{'crypto.randomUUID()'}</Code>. The ledger deduplicates on{' '}
        <Code>{'commandId'}</Code>, so reusing one will cause the second submission to be silently
        ignored.
      </P>

      <H3>actAs field</H3>
      <P>
        The <Code>{'actAs'}</Code> array must include the sender{"'"}s <Code>{'partyId'}</Code>.
        This is available on <Code>{'session.partyId'}</Code> after connecting.
      </P>

      <PrevNext />
    </>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 600 }}>{children}</strong>;
}
