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
        the user. Depending on the registry and receiver preapproval, the result can settle
        directly or create a <Code>{'TransferInstruction'}</Code> awaiting further steps.
      </P>

      <Callout type="warning">
        <Strong>Common mistake:</Strong> exercising{' '}
        <Code>{'Amulet_Transfer'}</Code> directly on{' '}
        <Code>{'#splice-amulet:Splice.Amulet:Amulet'}</Code> is the{' '}
        wrong contract/choice combination for the Token Standard factory flow. A legacy command
        cannot be assumed valid for your deployed package. Use the deployed Token Standard
        interface and the registry&apos;s current factory/context.
      </Callout>

      <H2 id="the-flow">The Token Standard transfer flow</H2>
      <P>
        Canton Improvement Proposal <Strong>CIP-0056</Strong> supports direct, self and offer
        transfer workflows. An offer commonly uses these two steps:
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
          settles the transfer, input holdings are burned, output holdings are minted.
        </LI>
      </UL>
      <P>
        The sender does <Strong>not</Strong> exercise a choice on their own{' '}
        <Code>{'Splice.Amulet:Amulet'}</Code> contract, under CIP-56 the Amulet is a{' '}
        <Code>{'Holding'}</Code> (data only), and transfer logic lives on the factory.
      </P>

      <H2 id="prerequisites">Prerequisites</H2>
      <UL>
        <LI>Wallet connected, see <a href="/docs/quick-start" style={{ color: '#E6B800' }}>Quick Start</a></LI>
        <LI>
          A <Strong>TransferFactory contractId</Strong>, fetched from the app-provider{"'"}s
          Scan token-standard registry API. For Amulet, that is the{' '}
          <Code>{'POST /registry/transfer-instruction/v1/transfer-factory'}</Code> endpoint of the DSO{"'"}s
          Scan (it returns the <Code>{'factoryId'}</Code> plus a{' '}
          <Code>{'choiceContext.choiceContextData'}</Code> blob to pass as{' '}
          <Code>{'extraArgs.context'}</Code>).
        </LI>
        <LI>
          One or more <Strong>input holding contractIds</Strong>, fetched from your own ACS (see{' '}
          <a href="/docs/wallet-balances" style={{ color: '#E6B800' }}>Wallet Balances</a>) using the{' '}
          <Code>{'#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding'}</Code> interfaceId.
        </LI>
        <LI>
          Recipient <Strong>partyId</Strong> and the instrument details ({' '}
          <Code>{'admin'}</Code> = DSO party, <Code>{'id'}</Code> = <Code>{'"Amulet"'}</Code>).
        </LI>
      </UL>

      <H2 id="react">React (interface-based TransferFactory_Transfer)</H2>

      <CodeBlock language="tsx">{`import { useAccount, useTransactionFlow } from '@partylayer/react';
import type { TokenDisclosedContract } from '@partylayer/react/query';

const TRANSFER_FACTORY_INTERFACE =
  '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory';

function TransferButton({
  factoryCid,
  choiceContext,
  disclosedContracts,
  inputHoldingCids,
  dsoParty,
  receiverPartyId,
}: {
  factoryCid: string;             // factoryId from Scan transfer-factory
  choiceContext: Record<string, unknown>; // raw choiceContext.choiceContextData from Scan
  disclosedContracts: TokenDisclosedContract[]; // from that SAME fresh choice context
  inputHoldingCids: string[];     // from your ACS query
  dsoParty: string;               // instrument admin (e.g. DSO on the network)
  receiverPartyId: string;
}) {
  const { isConnected, party } = useAccount();
  const flow = useTransactionFlow(); // add an independent confirm reader; see Transaction lifecycle

  const handleTransfer = async () => {
    if (!isConnected || !party) return;

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
                sender: party,
                receiver: receiverPartyId,
                amount: '10.0',
                instrumentId: { admin: dsoParty, id: 'Amulet' },
                lock: null,
                requestedAt: nowIso,
                executeBefore: expiresIso,
                inputHoldingCids,
                meta: { values: {} },
              },
              // extraArgs.context is the ChoiceContext blob from the Scan
              // transfer-factory response, passed through unchanged. The
              // canonical Splice CLI assigns it verbatim, with NO extra wrapping:
              //   extraArgs.context = transferFactory.choiceContext.choiceContextData
              // choiceContext below already IS that choiceContextData object.
              extraArgs: {
                context: choiceContext,
                meta: { values: {} },
              },
            },
          },
        },
      ],
      commandId: crypto.randomUUID(),
      applicationId: 'my-app',
      actAs: [party],
      readAs: [],
      disclosedContracts,
    };

    // Wallet-owned prepare/approve/sign/execute. Exactly one submission.
    const result = await flow.submitTransaction({ signedTx: payload }, { commandId: payload.commandId });
    console.log(result.status, result.receipt); // submitted is NOT settled
  };

  if (!isConnected) return null;

  return (
    <>
      <button onClick={() => { void handleTransfer().catch(console.error); }} disabled={flow.isPending}>
        {flow.isPending ? 'Awaiting wallet…' : 'Transfer 10 Amulet'}
      </button>
      {flow.transaction?.error && <p>Error: {flow.transaction.error.message}</p>}
    </>
  );
}`}</CodeBlock>

      <Callout type="warning">
        <Strong>Preserve the wallet approval path.</Strong> Submit through the supported wallet
        action; native CIP-0103 connections use <Code>{'prepareExecute'}</Code> or the negotiated
        wait extension. Do not substitute a raw ledger write or sign an arbitrary transaction hash.
        The factory/context must be prepared for this exact party, network, amount, receiver and
        expiry; discard it when any of those change. Include its disclosures and synchronizer data.
        Independently confirm the ledger update, then inspect the transfer result: a committed
        instruction can still require receiver acceptance. See <a href="/docs/transaction-lifecycle">Transaction lifecycle</a>.
      </Callout>

      <Callout type="note">
        <Strong>Where do <Code>{'factoryCid'}</Code> and <Code>{'choiceContext'}</Code> come from?</Strong>{' '}
        From the Splice Scan token-standard registry API that the registry issuer runs. You call{' '}
        <Code>{'POST /registry/transfer-instruction/v1/transfer-factory'}</Code>{' '}
        with the transfer <Code>{'choiceArguments'}</Code> in the body, and it returns{' '}
        <Code>{'{ factoryId, transferKind, choiceContext: { choiceContextData, disclosedContracts } }'}</Code>.
        Use <Code>{'factoryId'}</Code> as the factory contractId and pass{' '}
        <Code>{'choiceContext.choiceContextData'}</Code> through as <Code>{'extraArgs.context'}</Code>.
        The path is the canonical spec route; a given deployment may front it under a Scan proxy prefix
        (for example <Code>{'/api/scan/v0'}</Code>). This is dApp-side off-ledger coordination, so
        PartyLayer does not abstract it.
      </Callout>

      <H2 id="loop-fast-path">Wallet-owned transfer convenience</H2>
      <P>
        PartyLayer also exposes a typed <Code>{'useTransfer'}</Code> / <Code>{'client.transfer'}</Code>
        action for wallets that declare the transfer capability. The wallet then selects holdings,
        constructs the transfer, displays approval and returns a real update id. This convenience
        is capability-dependent; it is not a universal CIP-0103 method. The ordinary PartyLayer
        installation already includes supported wallet runtimes.
      </P>
      <P>
        For application-owned Token Standard workflows, retain the factory command route above.
        A typed hook supplies the cache and mutation lifecycle; the registry still supplies current
        choice context and disclosures. Refresh spent contract ids and expired context before a new intent.
      </P>
      <Callout type="tip">
        Check the connected wallet&apos;s capabilities and supported network. A successful message
        signature is not proof that a transfer works. Never retry an unknown submission to obtain
        a better receipt; reconcile the original command or business intent first.
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

await client.submitTransaction({
  signedTx: {
    commands: [{
      ExerciseCommand: {
        templateId: TRANSFER_INSTRUCTION_INTERFACE, // interfaceId goes in templateId
        contractId: instructionCid,                 // from the recipient's ACS
        choice: 'TransferInstruction_Accept',
        choiceArgument: {
          extraArgs: {
            context: acceptChoiceContext, // raw choiceContextData from Scan, passed through unchanged
            meta: { values: {} },
          },
        },
      },
    }],
    commandId: crypto.randomUUID(),
    applicationId: 'my-app',
    actAs: [recipientPartyId],
    readAs: [],
    disclosedContracts: acceptDisclosedContracts, // from the fresh ACCEPT context
  },
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
        <Code>{'actAs'}</Code> matches the active <Code>{'party'}</Code> (from <Code>{'useAccount()'}</Code>).
      </P>

      <H3 id="template-id-format">Template / interface ID format</H3>
      <P>
        Use a fully-qualified identifier: deployed package id, module and entity. A package-name
        reference such as <Code>{'#splice-api-token-transfer-instruction-v1:...'}</Code> also
        requires support from the selected wallet and participant. Do not pass an unqualified
        module/entity or a guessed package hash.
      </P>

      <H3 id="command-id">commandId uniqueness</H3>
      <P>
        Generate one <Code>{'commandId'}</Code> for each new business intent and retain it across
        lost responses and reload recovery. Do not generate a new id to retry an unknown write.
        Ledger deduplication has a submission identity and configured window; it does not replace
        application intent tracking. Never reuse an old id for a different operation.
      </P>

      <H3 id="error-handling">Error handling</H3>
      <CodeBlock language="typescript">{`import {
  UserRejectedError,
  SessionExpiredError,
  CapabilityNotSupportedError,
} from '@partylayer/sdk';

try {
  const result = await client.submitTransaction({ signedTx: payload });
  // A returned acknowledgement still needs independent ledger confirmation.
} catch (err) {
  if (err instanceof UserRejectedError) {
    // Show rejection. A new attempt requires another explicit user action.
  } else if (err instanceof SessionExpiredError) {
    // Offer reconnect. Reconcile any issued write before a new submission.
  } else if (err instanceof CapabilityNotSupportedError) {
    // Explain that this operation is unavailable for the selected wallet.
  } else {
    // Preserve unknown outcome. Do not automatically send the payload again.
  }
}`}</CodeBlock>

      <H2 id="references">References</H2>
      <UL>
        <LI>
          <a href="https://github.com/hyperledger-labs/splice/tree/main/token-standard" target="_blank" rel="noopener noreferrer" style={{ color: '#E6B800' }}>
            hyperledger-labs/splice &rarr; token-standard
          </a>
          {' '},  Daml sources for <Code>{'TransferFactory'}</Code>, <Code>{'TransferInstruction'}</Code>, and <Code>{'Holding'}</Code>.
        </LI>
        <LI>
          <a href="https://github.com/canton-foundation/cips/blob/main/cip-0078/cip-0078.md" target="_blank" rel="noopener noreferrer" style={{ color: '#E6B800' }}>
            CIP-56 / CIP-78, Canton Token Standard
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
