'use client';

import { useDocs } from '../layout';

export default function TokenTransfersContent() {
  const { H1, H2, H3, P, Code, CodeBlock, Callout, PrevNext, UL, LI } = useDocs();

  return (
    <>
      <H1>Token Transfers</H1>
      <P>
        Transferring Amulet (or any CIP-56 token) on Canton goes through the{' '}
        <Strong>Token Standard</Strong>: you exercise a factory choice by{' '}
        <Strong>interface</Strong>, not a choice on the holding contract itself. The wallet prompts
        the user, the factory produces a <Code>{'TransferInstruction'}</Code> contract, and the
        recipient accepts it.
      </P>

      <Callout type="warning">
        <Strong>Common mistake:</Strong> exercising{' '}
        <Code>{'Amulet_Transfer'}</Code> directly on{' '}
        <Code>{'#splice-amulet:Splice.Amulet:Amulet'}</Code> is the{' '}
        <Strong>legacy (pre-Token Standard) path</Strong>. On today{"'"}s Canton the ledger rejects
        it as an unknown choice and Loop{"'"}s UI shows{' '}
        <Code>{'Execute Unknown on Unknown'}</Code>. Use the Token Standard flow described below.
      </Callout>

      <H2 id="the-flow">The Token Standard transfer flow</H2>
      <P>
        Canton Improvement Proposal <Strong>CIP-56</Strong> defines a two-step transfer:
      </P>
      <UL>
        <LI>
          <Strong>Sender</Strong> exercises{' '}
          <Code>{'TransferFactory_Transfer'}</Code> by interface on a{' '}
          <Code>{'TransferFactory'}</Code> contract. The factory validates the request and creates a{' '}
          <Code>{'TransferInstruction'}</Code>.
        </LI>
        <LI>
          <Strong>Recipient</Strong> exercises{' '}
          <Code>{'TransferInstruction_Accept'}</Code> on the instruction contract. The ledger
          settles the transfer — input holdings are burned, output holdings are minted.
        </LI>
      </UL>
      <P>
        The sender does <Strong>not</Strong> exercise a choice on their own{' '}
        <Code>{'Splice.Amulet:Amulet'}</Code> contract — under CIP-56 the Amulet is a{' '}
        <Code>{'Holding'}</Code> (data only), and transfer logic lives on the factory.
      </P>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI>Wallet connected — see <a href="/docs/quick-start" style={{ color: '#E6B800' }}>Quick Start</a></LI>
        <LI>
          A <Strong>TransferFactory contractId</Strong> — fetched from the app-provider{"'"}s
          Scan / off-ledger API. For Amulet on mainnet/devnet, that{"'"}s the{' '}
          <Code>{'/registry/transfer-instruction/v1/transfer-factory'}</Code> endpoint of the DSO{"'"}s
          Scan (it returns both the factoryId and a <Code>{'ChoiceContext'}</Code> blob to pass as{' '}
          <Code>{'extraArgs.context'}</Code>).
        </LI>
        <LI>
          One or more <Strong>input holding contractIds</Strong> — fetched from your own ACS (see{' '}
          <a href="/docs/wallet-balances" style={{ color: '#E6B800' }}>Wallet Balances</a>) using the{' '}
          <Code>{'#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'}</Code> interfaceId.
        </LI>
        <LI>
          Recipient <Strong>partyId</Strong> and the instrument details ({' '}
          <Code>{'admin'}</Code> = DSO party, <Code>{'id'}</Code> = <Code>{'"Amulet"'}</Code>).
        </LI>
      </UL>

      <H2 id="react">React (interface-based TransferFactory_Transfer)</H2>

      <CodeBlock language="tsx">{`import { useSession, useLedgerApi } from '@partylayer/react';

const TRANSFER_FACTORY_INTERFACE =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory';

function TransferButton({
  factoryCid,
  choiceContext,
  inputHoldingCids,
  dsoParty,
  receiverPartyId,
}: {
  factoryCid: string;             // from Scan /transfer-factory
  choiceContext: Record<string, unknown>; // from Scan
  inputHoldingCids: string[];     // from your ACS query
  dsoParty: string;               // instrument admin (e.g. DSO on the network)
  receiverPartyId: string;
}) {
  const session = useSession();
  const { ledgerApi, isLoading, error } = useLedgerApi();

  const handleTransfer = async () => {
    if (!session) return;

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 5 * 60_000).toISOString();

    // v2 JSON Ledger API: interface exercises use the standard ExerciseCommand
    // wrapper with the interfaceId placed in the templateId field.
    const payload = {
      commands: [
        {
          ExerciseCommand: {
            templateId: TRANSFER_FACTORY_INTERFACE,
            contractId: factoryCid,
            choice: 'TransferFactory_Transfer',
            choiceArgument: {
              expectedAdmin: dsoParty,
              transfer: {
                sender: session.partyId,
                receiver: receiverPartyId,
                amount: '10.0',
                instrumentId: { admin: dsoParty, id: 'Amulet' },
                requestedAt: nowIso,
                executeBefore: expiresIso,
                inputHoldingCids,
                meta: { values: {} },
              },
              // ChoiceContext.values is a TextMap AnyValue. Each entry must
              // use the tagged-union form, e.g.
              //   { tag: 'AV_ContractId', value: '<cid>' }
              //   { tag: 'AV_Text',       value: '<string>' }
              //   { tag: 'AV_Party',      value: '<party>' }
              // The Scan /transfer-factory response already ships these values
              // in the correct shape — pass them through verbatim.
              extraArgs: {
                context: { values: choiceContext },
                meta: { values: {} },
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

    const result = await ledgerApi({
      requestMethod: 'POST',
      resource: '/v2/commands/submit-and-wait',
      body: JSON.stringify(payload),
    });

    if (result) {
      console.log('TransferInstruction created:', JSON.parse(result.response));
    }
  };

  if (!session) return null;

  return (
    <>
      <button onClick={handleTransfer} disabled={isLoading}>
        {isLoading ? 'Submitting…' : 'Transfer 10 Amulet'}
      </button>
      {error && <p>Error: {error.message}</p>}
    </>
  );
}`}</CodeBlock>

      <Callout type="note">
        <Strong>Where do <Code>{'factoryCid'}</Code> and <Code>{'choiceContext'}</Code> come from?</Strong>{' '}
        From the Splice Scan HTTP API that the registry issuer runs. For the Amulet DSO on
        devnet/mainnet, you call{' '}
        <Code>{'GET /api/scan/v0/registry/transfer-instruction/v1/transfer-factory'}</Code>{' '}
        (body includes the sender and receiver) and it returns{' '}
        <Code>{'{ factoryId, choiceContext, disclosedContracts }'}</Code>. This is dApp-side
        off-ledger coordination — PartyLayer does not abstract it because the endpoint varies by
        app provider.
      </Callout>

      <H2 id="loop-fast-path">Loop wallet — convenience helper</H2>
      <P>
        Loop{"'"}s own SDK ships a <Code>{'loop.wallet.transfer()'}</Code> helper that handles the
        Scan lookup, factory resolution, and submission for you. If your dApp targets Loop
        specifically, this is the simplest path. Access the underlying Loop SDK via the{' '}
        <Code>{'@fivenorth/loop-sdk'}</Code> package alongside PartyLayer:
      </P>
      <CodeBlock language="tsx">{`import { loop } from '@fivenorth/loop-sdk';

// After connecting via PartyLayer, loop.provider is the same provider instance.
await loop.wallet.transfer(
  receiverPartyId,   // "party::fingerprint"
  '10',              // amount as string
  { instrument_admin: dsoParty, instrument_id: 'Amulet' },
  { message: 'Payment for invoice #42', executionMode: 'wait' },
);`}</CodeBlock>
      <Callout type="tip">
        This path works only with Loop. For Console / Nightly / Bron, use the Token Standard
        command flow above — those wallets do not expose a high-level transfer helper.
      </Callout>

      <H2 id="recipient-accept">Recipient accepts the instruction</H2>
      <P>
        After the sender{"'"}s transaction commits, a{' '}
        <Code>{'TransferInstruction'}</Code> contract appears in the recipient{"'"}s ACS. The
        recipient{"'"}s dApp (or wallet UI) then exercises{' '}
        <Code>{'TransferInstruction_Accept'}</Code> on it:
      </P>
      <CodeBlock language="typescript">{`const TRANSFER_INSTRUCTION_INTERFACE =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction';

await client.ledgerApi({
  requestMethod: 'POST',
  resource: '/v2/commands/submit-and-wait',
  body: JSON.stringify({
    commands: [{
      ExerciseCommand: {
        templateId: TRANSFER_INSTRUCTION_INTERFACE, // interfaceId goes in templateId
        contractId: instructionCid,                 // from the recipient's ACS
        choice: 'TransferInstruction_Accept',
        choiceArgument: {
          extraArgs: {
            context: { values: acceptChoiceContext }, // tagged TextMap AnyValue from Scan
            meta: { values: {} },
          },
        },
      },
    }],
    commandId: crypto.randomUUID(),
    applicationId: 'my-app',
    actAs: [recipientPartyId],
    readAs: [],
  }),
});`}</CodeBlock>
      <P>
        Other instruction choices: <Code>{'TransferInstruction_Reject'}</Code>,{' '}
        <Code>{'TransferInstruction_Withdraw'}</Code> (sender cancels before accept),{' '}
        <Code>{'TransferInstruction_Update'}</Code>.
      </P>

      <H2 id="troubleshooting">Troubleshooting</H2>

      <H3 id="unknown-choice">Loop UI shows &quot;Execute Unknown on Unknown&quot;</H3>
      <P>
        You{"'"}re sending the legacy{' '}
        <Code>{'Amulet_Transfer'}</Code> command exercised directly on{' '}
        <Code>{'Splice.Amulet:Amulet'}</Code>. Loop{"'"}s UI (and Canton since CIP-56) does not
        recognize this command. Switch to{' '}
        <Code>{'TransferFactory_Transfer'}</Code> on the TransferFactory interface as shown above.
      </P>

      <H3 id="unexpected-response">&quot;Loop Wallet submitAndWaitForTransaction resolved with an empty response&quot;</H3>
      <P>
        The popup closed before you confirmed, or the wallet server returned an empty frame.
        Confirm in the wallet UI and retry. If it persists, double-check the interfaceId has the
        fully-qualified <Code>{'#package:Module:Interface'}</Code> form and that{' '}
        <Code>{'actAs'}</Code> matches <Code>{'session.partyId'}</Code>.
      </P>

      <H3 id="template-id-format">Template / interface ID format</H3>
      <P>
        Loop requires the fully-qualified Daml form with the package-name prefix —{' '}
        <Code>{'#splice-amulet:...'}</Code> or{' '}
        <Code>{'#splice-api-token-transfer-instruction-v1:...'}</Code>, not the short Canton form.
        Our adapter surfaces the short-form mistake as a clear error pointing at this fix.
      </P>

      <H3 id="command-id">commandId uniqueness</H3>
      <P>
        Always generate a fresh <Code>{'commandId'}</Code> per submission (for example{' '}
        <Code>{'crypto.randomUUID()'}</Code>). The ledger deduplicates on{' '}
        <Code>{'commandId'}</Code>, so reusing one silently drops the second submission.
      </P>

      <H3 id="error-handling">Error handling</H3>
      <CodeBlock language="typescript">{`import {
  UserRejectedError,
  SessionExpiredError,
  CapabilityNotSupportedError,
} from '@partylayer/sdk';

try {
  const result = await client.ledgerApi({
    requestMethod: 'POST',
    resource: '/v2/commands/submit-and-wait',
    body: JSON.stringify(payload),
  });
} catch (err) {
  if (err instanceof UserRejectedError) {
    // User declined in the wallet — safe to retry
  } else if (err instanceof SessionExpiredError) {
    await client.connect();
  } else if (err instanceof CapabilityNotSupportedError) {
    // Wallet doesn't support ledgerApi (e.g. Cantor8)
  } else {
    // Includes our defensive adapter errors:
    //  "requires a request body", "not valid JSON",
    //  "resolved with an empty response", "unexpected response shape"
  }
}`}</CodeBlock>

      <H2 id="references">References</H2>
      <UL>
        <LI>
          <a href="https://github.com/hyperledger-labs/splice/tree/main/token-standard" target="_blank" rel="noopener noreferrer" style={{ color: '#E6B800' }}>
            hyperledger-labs/splice &rarr; token-standard
          </a>
          {' '}— Daml sources for <Code>{'TransferFactory'}</Code>, <Code>{'TransferInstruction'}</Code>, and <Code>{'Holding'}</Code>.
        </LI>
        <LI>
          <a href="https://github.com/canton-foundation/cips/blob/main/cip-0078/cip-0078.md" target="_blank" rel="noopener noreferrer" style={{ color: '#E6B800' }}>
            CIP-56 / CIP-78 — Canton Token Standard
          </a>
        </LI>
        <LI>
          <a href="https://docs.global.canton.network.sync.global/app_dev/token_standard/index.html" target="_blank" rel="noopener noreferrer" style={{ color: '#E6B800' }}>
            Splice docs &rarr; Token Standard APIs
          </a>
        </LI>
        <LI>
          <a href="https://github.com/fivenorth-io/loop-sdk" target="_blank" rel="noopener noreferrer" style={{ color: '#E6B800' }}>
            Loop SDK &rarr; <Code>{'wallet.transfer()'}</Code> helper
          </a>
        </LI>
      </UL>

      <PrevNext />
    </>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ fontWeight: 600 }}>{children}</strong>;
}
