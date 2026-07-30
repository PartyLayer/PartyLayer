'use client';

import { useDocs } from '../layout';

export default function MultiPartyPatternsPage() {
  const { H1, H2, P, Code, CodeBlock, UL, LI, Strong, HR, A, PrevNext } = useDocs();

  return (
    <>
      <H1>Multi-Party Patterns</H1>
      <P>
        Multi-party flows on Canton are expressed as on-ledger workflows between parties. A
        transfer is a contract the receiver acts on; a settlement is a contract whose choice
        moves several parties{"'"} assets at once. The atomicity of these flows lives in Daml, in
        the choice bodies, not in the client. The client{"'"}s job is to read the right contract,
        present the available action, and submit a well-formed exercise.
      </P>
      <P>
        PartyLayer types each step of these workflows so a dApp does not hand-roll the request
        shapes. This guide documents four patterns. For each: the problem, the on-ledger shape,
        the kit surface, and a pointer to the working vertical that implements it.
      </P>
      <P>
        A note on Model 2, which runs through all four: PartyLayer types the request and the
        dApp owns the submit. The ledger read and the exercise both go through the dApp{"'"}s own
        transport, as described in the{' '}
        <A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/partylayer-and-canton-topology.md">topology guide</A>.
        The kit does not submit for you.
      </P>

      <HR />

      <H2 id="two-step-transfer-offer-and-accept">1. Two-step transfer (offer and accept)</H2>
      <P>
        <Strong>Problem.</Strong> A sender wants to move a holding to a receiver, but the receiver
        should be able to accept or refuse, and the sender should be able to back out while it is
        pending.
      </P>
      <P>
        <Strong>On-ledger shape.</Strong> Exercising <Code>{'TransferFactory_Transfer'}</Code> on
        the registry{"'"}s transfer factory creates a <Code>{'TransferInstruction'}</Code> contract.
        From there the receiver exercises accept or reject, and the sender can withdraw. The
        instruction carries a status that says which of these is currently possible.
      </P>
      <P>
        <Strong>Kit surface.</Strong> <Code>{'useTransferInstruction'}</Code> initiates the
        transfer; <Code>{'useTransferInstructionAction'}</Code> drives the completion actions, whose
        kinds are <Code>{'accept'}</Code>, <Code>{'reject'}</Code>, and <Code>{'withdraw'}</Code>{' '}
        (<Code>{'TransferInstructionActionKind'}</Code>). Discriminate what is allowed on the pending
        instruction via <Code>{'TokenTransferInstructionStatus'}</Code>:
      </P>
      <CodeBlock language="ts">{`// TokenTransferInstructionStatus, from @partylayer/react/query
type TokenTransferInstructionStatus =
  | { kind: 'pendingReceiverAcceptance' }
  | { kind: 'pendingInternalWorkflow'; pendingActions: Record<string, string> };`}</CodeBlock>
      <P>
        <Code>{'pendingReceiverAcceptance'}</Code> is the state where the receiver can accept or
        reject. <Code>{'pendingInternalWorkflow'}</Code> carries <Code>{'pendingActions'}</Code>, a
        map from party to a short description of which party could act to advance the transfer,
        which the wallet can show to the user.
      </P>
      <P>
        The transfer factory also reports a <Code>{'transferKind'}</Code> of <Code>{'offer'}</Code>,{' '}
        <Code>{'direct'}</Code>, or <Code>{'self'}</Code>: <Code>{'offer'}</Code> waits for the
        receiver to accept, <Code>{'direct'}</Code> transfers straight through and is only chosen
        when the receiver has pre-approved direct transfers, and <Code>{'self'}</Code> is a
        self-transfer where sender and receiver are the same party and no approval is needed.
      </P>
      <P>
        <Strong>Example.</Strong> The tokenization vertical (<Code>{'apps/tokenization'}</Code>).
      </P>

      <HR />

      <H2 id="atomic-delivery-versus-payment">2. Atomic delivery versus payment</H2>
      <P>
        <Strong>Problem.</Strong> Two parties want to swap assets so that either both legs move or
        neither does. Neither side should be able to take delivery without paying.
      </P>
      <P>
        <Strong>On-ledger shape.</Strong> A settlement app publishes a request for allocations.
        Each transfer leg{"'"}s sender allocates the asset it owes, producing an{' '}
        <Code>{'Allocation'}</Code> per leg. A single settle choice on the settlement contract then
        runs <Code>{'Allocation_ExecuteTransfer'}</Code> for every leg inside one transaction, so the
        whole settlement is all-or-nothing. The official Splice token-standard trading-app example
        is the canonical reference for the settle choice.
      </P>
      <P>
        <Strong>Kit surface.</Strong> <Code>{'useAllocationRequests'}</Code> reads the pending
        requests a party can act on; <Code>{'useAllocationInstruction'}</Code> allocates a leg;{' '}
        <Code>{'useTokenAllocations'}</Code> reads the funded allocations;{' '}
        <Code>{'useAllocationAction'}</Code> acts on one. The venue{"'"}s expected-allocation check,
        deciding whether a given allocation actually satisfies a given leg of a request, uses the
        framework-free matching helpers, chiefly <Code>{'allocationMatchesRequestLeg'}</Code>, so
        amount comparison is decimal-as-string correct rather than a naive <Code>{'==='}</Code>.
      </P>
      <P>
        Two deadlines on the request bound the flow: <Code>{'allocateBefore'}</Code>, by which the
        senders must have allocated, and <Code>{'settleBefore'}</Code>, by which the executor must
        settle. And the settle step is not a rehearsal: executing the transfer moves real assets on
        the ledger, so the matching check and the deadlines matter before you submit it.
      </P>
      <P>
        <Strong>Example.</Strong> The dvp vertical (<Code>{'apps/dvp'}</Code>), whose{' '}
        <Code>{'src/lib/match.ts'}</Code> is a thin adapter over{' '}
        <Code>{'allocationMatchesRequestLeg'}</Code>.
      </P>

      <HR />

      <H2 id="abort-and-release-paths">3. Abort and release paths</H2>
      <P>
        <Strong>Problem.</Strong> Settlements do not always complete. A leg sender may decline, an
        executor may find it cannot settle in time, or a party that allocated may need to reclaim
        its asset. Each of these needs a defined owner, or funds get stuck.
      </P>
      <P>
        <Strong>On-ledger shape.</Strong> There are release points at two levels. At the request
        level, <Code>{'AllocationRequest_Reject'}</Code> and{' '}
        <Code>{'AllocationRequest_Withdraw'}</Code> end the request. At the allocation level, an{' '}
        <Code>{'Allocation'}</Code> can be cancelled or withdrawn, releasing the asset the sender
        had committed.
      </P>
      <P>
        <Strong>Kit surface.</Strong> <Code>{'useAllocationRequestAction'}</Code> covers the request
        level with kinds <Code>{'reject'}</Code> and <Code>{'withdraw'}</Code>{' '}
        (<Code>{'AllocationRequestActionKind'}</Code>). The two have different controllers, which is
        the point: reject carries the acting party (the <Code>{'actor'}</Code>), and implementations
        SHOULD allow any sender of a transfer leg to reject, while withdraw belongs to the
        settlement{"'"}s <Code>{'executor'}</Code>, used when the executor cannot execute.{' '}
        <Code>{'useAllocationAction'}</Code> covers the allocation level with kinds{' '}
        <Code>{'executeTransfer'}</Code>, <Code>{'cancel'}</Code>, and <Code>{'withdraw'}</Code>{' '}
        (<Code>{'AllocationActionKind'}</Code>); cancel and withdraw are the release paths that hand
        the committed asset back. A venue UI needs these because a settlement that cannot proceed
        must be closable by whoever is entitled to close it, rather than left pending against the
        deadlines above.
      </P>
      <P>
        <Strong>Example.</Strong> The dvp vertical (<Code>{'apps/dvp'}</Code>).
      </P>

      <HR />

      <H2 id="registry-mediated-writes">4. Registry-mediated writes</H2>
      <P>
        <Strong>Problem.</Strong> The registry-specific part of a write (which factory contract to
        use, what reference data to disclose, what context a choice needs) is off-ledger and not
        standardized in the ledger transaction itself. The client cannot invent it.
      </P>
      <P>
        <Strong>On-ledger shape.</Strong> Every write goes through a registry factory or a
        per-action choice context. The dApp fetches that context from the registry{"'"}s off-ledger
        API and passes it into the exercise as <Code>{'extraArgs.context'}</Code>, alongside the{' '}
        <Code>{'disclosedContracts'}</Code> the choice references. This is why the kit types the
        request but the dApp owns the submit: the registry context is fetched by the dApp{"'"}s own
        fetcher, so PartyLayer cannot and does not supply it. That is Model 2.
      </P>
      <P>
        <Strong>Kit surface.</Strong> The disclosure helpers are the shared plumbing here.{' '}
        <Code>{'TokenDisclosedContract'}</Code> and <Code>{'TokenChoiceContext'}</Code> are the typed
        shapes the registry returns. When a submission combines more than one context,{' '}
        <Code>{'mergeDisclosedContracts'}</Code> folds their disclosures into one set, and{' '}
        <Code>{'assertSingleSynchronizer'}</Code> checks that set is consistent on a single
        synchronizer before you build the command. <Code>{'attachDisclosedContracts'}</Code> then
        writes that set onto the command payload, merging through <Code>{'mergeDisclosedContracts'}</Code>{' '}
        and never mutating the input, so you do not hand write the <Code>{'disclosedContracts'}</Code>{' '}
        field. Model 2 still holds: the helper only builds the command, the dApp submits it through
        its own fetcher. A sketch of where they sit in a submit fetcher:
      </P>
      <CodeBlock language="ts">{`import {
  mergeDisclosedContracts,
  assertSingleSynchronizer,
  attachDisclosedContracts,
} from '@partylayer/react/query';

// ctxA, ctxB: TokenChoiceContext values fetched from the registry
const disclosed = mergeDisclosedContracts(ctxA.disclosedContracts, ctxB.disclosedContracts);
assertSingleSynchronizer(disclosed); // throws if the contexts span synchronizers
// Attach onto the command, then submit it with your own fetcher (Model 2).
const command = attachDisclosedContracts(baseCommand, disclosed);
// ...exercise the choice with extraArgs.context filled and \`command\` submitted.`}</CodeBlock>
      <P>
        <Strong>Example.</Strong> Both verticals write this way; the disclosed-contract and
        choice-context shapes are shared across tokenization and dvp. See the{' '}
        <A href="https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md">CIP-0056 specification</A>{' '}
        for the standard these shapes mirror.
      </P>

      <HR />

      <H2 id="see-also">See also</H2>
      <UL>
        <LI><A href="/docs/privacy-and-reads">Privacy-aware reads on Canton</A></LI>
        <LI><A href="/docs/generic-bridge">Generic Bridge (wallet discovery)</A></LI>
        <LI><A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/partylayer-and-canton-topology.md">PartyLayer and Canton Topology</A></LI>
        <LI><A href="https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md">CIP-0056 (Canton Token Standard) specification</A></LI>
      </UL>

      <PrevNext />
    </>
  );
}
