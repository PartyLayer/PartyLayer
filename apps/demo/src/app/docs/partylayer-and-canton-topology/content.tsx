'use client';

import { useDocs } from '../layout';

export default function CantonTopologyContent() {
  const { H1, H2, P, Code, CodeBlock, Callout, PrevNext, UL, LI, Strong, A } = useDocs();

  return (
    <>
      <H1>PartyLayer and Canton Topology: Where Your DARs Go</H1>
      <P>
        When integrating PartyLayer alongside your own DAML templates, a natural point of confusion is
        where DAR files need to be published: to the wallets&apos; validators, or to a PartyLayer
        validator that then bridges them to the wallets. Neither is correct. DAR placement is governed
        entirely by Canton&apos;s topology, not by PartyLayer.
      </P>
      <P>
        PartyLayer has no validator and is not a ledger bridge, so there is nothing on PartyLayer&apos;s
        side to publish a DAR to. Where DARs go is the same with or without PartyLayer: they go where
        Canton&apos;s topology requires. This document explains that boundary and where PartyLayer sits
        relative to it.
      </P>

      <H2 id="what-partylayer-is">What PartyLayer is, and what it is not</H2>
      <P>
        PartyLayer is a CIP-0103 wallet connection SDK. It connects the user&apos;s wallet, requests
        signatures, and relays a prepared transaction to the wallet, which submits it through the
        wallet&apos;s own validator.
      </P>
      <P>It is not any of these:</P>
      <UL>
        <LI>
          <Strong>It is not a validator.</Strong> There is no PartyLayer participant node, and no
          PartyLayer DAR store. You cannot upload a DAR &quot;to PartyLayer&quot; because there is
          nothing there to upload it to.
        </LI>
        <LI>
          <Strong>It is not a ledger bridge.</Strong> PartyLayer does not sit on the ledger data path,
          does not forward your contracts between participants, and does not synchronize transactions.
        </LI>
        <LI>
          <Strong>It is not a participant and does not host parties.</Strong> Parties are hosted by
          Canton participants (validators), not by PartyLayer.
        </LI>
      </UL>
      <Callout type="note" title="Two senses of the word bridge">
        PartyLayer uses &quot;bridge&quot; in one specific and unrelated place. The{' '}
        <A href="/docs/generic-bridge">generic bridge</A> is the wallet discovery handshake: the
        CIP-0103 announce mechanism (the Canton analog of EIP-6963) by which wallets announce
        themselves to the dApp. That is a front-end discovery bridge between a dApp and browser
        wallets. It is not a ledger bridge, and it has nothing to do with where DARs live or how
        transactions synchronize. Do not let the two senses of the word collide.
      </Callout>

      <H2 id="where-dars-live">Where your DAML packages (DARs) must live</H2>
      <P>This is governed by Canton, independent of PartyLayer. The rules that matter here:</P>
      <UL>
        <LI>
          There is no global DAR repository. Canton has no central place that all participants read
          packages from. Participants cannot read each other&apos;s packages.
        </LI>
        <LI>
          For two participants to synchronize a transaction that uses your templates, both must have
          uploaded and vetted the same DAR before submission. If a participant involved in the
          transaction has not vetted your package, the transaction is rejected (for example with a{' '}
          <Code>{'package-not-vetted'}</Code> error, or <Code>{'NO_DOMAIN_FOR_SUBMISSION'}</Code> when
          no synchronizer can route it because of the missing vetting).
        </LI>
      </UL>
      <P>
        So the rule of thumb is: your package must be vetted on every participant that hosts a party
        that is a stakeholder (a signatory or observer) on your contracts. In practice that means:
      </P>
      <UL>
        <LI>
          Your application&apos;s own validator, which hosts your app&apos;s parties and submits your
          transactions. Your DAR is uploaded and vetted there.
        </LI>
        <LI>
          The validator of any wallet whose user&apos;s party is a stakeholder on your templates. If a
          user&apos;s party is a signatory or observer on one of your contracts, the participant
          hosting that party must have your package vetted in order to validate the transaction.
        </LI>
      </UL>
      <P>
        And the important narrowing: a wallet whose user only connects and signs, where that
        user&apos;s party is not a stakeholder on your contracts, does not need your DAR. The DAR
        requirement follows stakeholder participation, not connection. A party that merely
        authenticates and signs something, without being a signatory or observer on your templates,
        does not pull your package onto its hosting participant.
      </P>
      <Callout type="note">
        This is a Canton property. PartyLayer does not change it, relax it, or work around it.
      </Callout>

      <H2 id="where-partylayer-fits">Where PartyLayer fits in this picture</H2>
      <P>
        Once your packages are vetted on the participants that need them, PartyLayer handles the
        front-end connection and signing flow. Its role, in Model 2 terms (the data model where the
        dApp owns ledger transport):
      </P>
      <UL>
        <LI>Connect the user&apos;s wallet over CIP-0103.</LI>
        <LI>
          Read your contracts through your own Ledger API or JSON API. PartyLayer&apos;s query hooks,{' '}
          <Code>{'useDamlContract'}</Code> and <Code>{'useChoice'}</Code> in the <Code>{'/query'}</Code>{' '}
          entrypoint, are schema-agnostic wrappers around a fetcher that you supply. They wrap your read
          and exercise calls in TanStack Query for caching and state, but the actual ledger read goes
          through your transport, not through PartyLayer. PartyLayer is not a ledger client.
        </LI>
        <LI>
          Relay the prepared transaction to the wallet for signing and submission. The wallet submits
          through its own validator.
        </LI>
      </UL>
      <P>
        PartyLayer never changes where DARs live or who vets them. It is the connection and relay layer
        in front of a topology you have already set up correctly.
      </P>

      <H2 id="the-picture">The picture</H2>
      <CodeBlock language="text">{`   Your dApp                         PartyLayer                    User's wallet
   (your validator,                  (connection + relay,          (its own validator;
    your DAR vetted)                  not a validator,              your DAR vetted there
        |                             not on the data path)         only if the user's
        |                                   |                        party is a stakeholder)
        |   read your contracts via         |                                |
        |   YOUR Ledger API / JSON API      |                                |
        |   (Model 2: you supply the        |                                |
        |    fetcher; hooks wrap it)        |                                |
        |                                   |   connect / sign / relay        |
        |  <------------- PartyLayer connection -------------------------->   |
        |                                   |   prepared tx                   |
        |                                   |                                 v
        |                                   |                          submit via the
        |                                   |                          wallet's validator
        v                                   |                                 |
   ------------------------------ Canton ledger / synchronizer ------------------------------
        (a transaction synchronizes only if every stakeholder's hosting participant
         has your DAR vetted; PartyLayer is the connection, never the data path)`}</CodeBlock>
      <P>
        The data path for reading contracts is your dApp to your Ledger API. PartyLayer is the
        connection and signing relay alongside it, not in the middle of it.
      </P>

      <H2 id="common-misconceptions">Common misconceptions</H2>
      <UL>
        <LI>
          <Strong>Misconception: that PartyLayer bridges DAML templates to the wallets.</Strong>{' '}
          Whether two participants can transact on a set of templates is governed by Canton topology and
          DAR vetting. PartyLayer connects the wallet and relays a prepared transaction; it does not
          move packages or contract data between participants.
        </LI>
        <LI>
          <Strong>Misconception: that DARs are uploaded to PartyLayer.</Strong> There is no PartyLayer
          validator to upload to. DARs go to Canton participants (the application&apos;s validator, and
          any stakeholder party&apos;s hosting participant).
        </LI>
        <LI>
          <Strong>Misconception: that the generic bridge bridges the ledger.</Strong> The generic
          bridge is wallet discovery (the CIP-0103 announce handshake), not a ledger bridge.
        </LI>
        <LI>
          <Strong>Misconception: that PartyLayer reads contracts on the dApp&apos;s behalf.</Strong>{' '}
          PartyLayer&apos;s hooks wrap a fetcher the dApp supplies. The read goes through the
          dApp&apos;s Ledger API or JSON API. PartyLayer is not a ledger client.
        </LI>
      </UL>

      <H2 id="see-also">See also</H2>
      <UL>
        <LI><A href="/docs/generic-bridge">Generic Bridge (wallet discovery)</A></LI>
        <LI><A href="/docs/dev-and-staging">Dev and Staging guide</A></LI>
        <LI><A href="/docs/quick-start">Quick Start</A></LI>
        <LI>
          <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/architecture.md">
            Architecture
          </A>
        </LI>
      </UL>

      <PrevNext />
    </>
  );
}
