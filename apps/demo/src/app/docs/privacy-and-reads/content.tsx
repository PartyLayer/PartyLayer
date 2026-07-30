'use client';

import { useDocs } from '../layout';

export default function PrivacyAndReadsPage() {
  const { H1, H2, P, Code, CodeBlock, PrevNext, UL, LI, HR, A } = useDocs();

  return (
    <>
      <H1>Privacy and Reads</H1>
      <P>
        On Canton the ledger itself enforces what a party can see. A contract is only visible
        to the parties that are stakeholders on it, so a wallet kit does not filter privacy on
        the client. The job is not to hide data that arrived; it is to read the right slice and
        to key caches per party so one party never sees another{"'"}s cached reads.
      </P>
      <P>
        This guide covers how PartyLayer{"'"}s read surface lines up with Canton{"'"}s visibility
        model, and the one place where a dApp can still leak across parties by accident: cache
        scoping.
      </P>

      <HR />

      <H2 id="witness-based-visibility-the-acs-is-already-scoped">Witness-based visibility: the ACS is already scoped</H2>
      <P>
        A party{"'"}s active-contract set (ACS) contains only the contracts that party is a
        stakeholder on (a signatory or observer). That is a ledger property, the same one the{' '}
        <A href="/docs/partylayer-and-canton-topology">topology guide</A> leans on when it says a
        package must be vetted on every participant that hosts a stakeholder party. An ACS read
        for a party therefore comes back already privacy-scoped: the participant will not return
        a contract the party cannot witness.
      </P>
      <P>
        The consequence for a dApp is that there is nothing to post-filter for privacy. When a
        read returns a set of contracts, that set is what the party is entitled to see. You do
        not run a client-side allow-list over it to remove other parties{"'"} data, because that
        data never arrived in the first place. Client-side filtering is for the app{"'"}s own
        view concerns (sorting, paging, {'"hide zero balances"'}), not for privacy.
      </P>

      <HR />

      <H2 id="interface-views-are-the-disclosure-decomposition">Interface views are the disclosure decomposition</H2>
      <P>
        The Canton Token Standard (CIP-0056) exposes each contract through a Daml interface
        view: <Code>{'HoldingView'}</Code>, <Code>{'TransferInstructionView'}</Code>,{' '}
        <Code>{'AllocationView'}</Code>, and <Code>{'AllocationRequestView'}</Code>. The view is
        the shape a counterparty is meant to see, which is exactly what makes it the right read
        target. You read the interface, not the underlying registry-specific template, so your
        code depends on the standardized disclosed shape rather than on Amulet internals.
      </P>
      <P>PartyLayer{"'"}s typed read hooks map one to one onto those views:</P>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13.5,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
          border: '1px solid rgba(15,23,42,0.10)', borderRadius: 10, overflow: 'hidden',
        }}>
          <thead>
            <tr style={{ background: '#F5F6F8' }}>
              {['Interface view', 'Read hook'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#0B0F1A', borderBottom: '1px solid rgba(15,23,42,0.10)', fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { view: 'HoldingView', hook: 'useTokenHoldings' },
              { view: 'TransferInstructionView', hook: 'useTransferInstructions' },
              { view: 'AllocationView', hook: 'useTokenAllocations' },
              { view: 'AllocationRequestView', hook: 'useAllocationRequests' },
            ].map(r => (
              <tr key={r.view} style={{ borderBottom: '1px solid rgba(15,23,42,0.10)' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#E6B800', fontWeight: 500 }}>{r.view}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#475569' }}>{r.hook}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>
        Each hook returns contract refs, not bare views: a <Code>{'{ cid, view }'}</Code> pair
        where <Code>{'cid'}</Code> is the ACS contract id and the view is the typed disclosed
        shape (for holdings the ref is <Code>{'{ cid, holding }'}</Code>, for instructions{' '}
        <Code>{'{ cid, instruction }'}</Code>, and so on). The <Code>{'cid'}</Code> is kept
        because the write side needs it: it is what a later choice is exercised on, or what feeds{' '}
        <Code>{'inputHoldingCids'}</Code> on a transfer. The view is what you render.
      </P>
      <P>
        These hooks are Model 2 reads: they wrap a fetcher you supply, so the ledger read runs
        through your own Ledger API or JSON API, and the ledger scopes it. PartyLayer is not a
        ledger client and does not widen what the fetcher returns.
      </P>

      <HR />

      <H2 id="observers-by-design-how-discovery-is-granted">Observers by design: how discovery is granted</H2>
      <P>
        Some contracts are meant to be found by a counterparty that is not a signatory. The
        allocation-request flow is the clearest case. The standard states that a settlement
        app{"'"}s implementation SHOULD make at least all senders of the transfer legs observers
        of the <Code>{'AllocationRequest'}</Code>, so those senders{"'"} wallets discover the
        pending request through an ordinary ACS read. Visibility here is a deliberate topology
        choice by the settlement app, not something the wallet kit arranges.
      </P>
      <P>
        Because visibility is granted per party, the request a given party sees MAY be a partial
        picture. The <Code>{'transferLegs'}</Code> on an <Code>{'AllocationRequest'}</Code> view
        may or may not be the complete list of the settlement{"'"}s legs, depending on the
        confidentiality requirements of the app: a party can be made an observer that sees only
        the legs it needs to act on. A dApp reading <Code>{'useAllocationRequests'}</Code> should
        treat <Code>{'transferLegs'}</Code> as {'"the legs this party can see"'}, not{' '}
        {'"every leg in the settlement"'}.
      </P>

      <HR />

      <H2 id="explicit-disclosure-for-the-other-direction">Explicit disclosure for the other direction</H2>
      <P>
        Witness-based visibility covers what a party can read. The reverse direction, showing a
        counterparty{"'"}s participant a contract it is not a stakeholder on so that a choice can
        reference it, is handled by explicit disclosure rather than by widening visibility. When
        a registry answers a factory or choice-context request, it hands back the reference data
        as disclosed contracts alongside the context that refers to them.
      </P>
      <P>PartyLayer types these wire shapes in the <Code>{'/query'}</Code> entrypoint:</P>
      <UL>
        <LI>
          <Code>{'TokenDisclosedContract'}</Code>: one contract disclosed to the participant,
          carrying its <Code>{'templateId'}</Code>, <Code>{'contractId'}</Code>,{' '}
          <Code>{'createdEventBlob'}</Code>, and a required <Code>{'synchronizerId'}</Code> (the
          synchronizer the contract is currently assigned to). Its{' '}
          <Code>{'debugPackageName'}</Code>, <Code>{'debugPayload'}</Code>, and{' '}
          <Code>{'debugCreatedAt'}</Code> are provider hints to trust ONLY if you trust the
          provider, since they may not match the <Code>{'createdEventBlob'}</Code>.
        </LI>
        <LI>
          <Code>{'TokenChoiceContext'}</Code>: the <Code>{'choiceContextData'}</Code> plus the{' '}
          <Code>{'disclosedContracts'}</Code> it refers to by contract id.
        </LI>
        <LI>
          <Code>{'mergeDisclosedContracts(...lists)'}</Code>: combines the disclosures of several
          registry contexts (for example a factory context plus a per-action choice context) into
          one submission{"'"}s disclosed contracts, deduplicating by <Code>{'contractId'}</Code>{' '}
          with the first occurrence winning.
        </LI>
      </UL>
      <P>
        Because a single submission{"'"}s disclosed contracts must all live on one synchronizer,
        two helpers validate a combined set before you build the command:
      </P>
      <UL>
        <LI>
          <Code>{'groupDisclosedContractsBySynchronizer(contracts)'}</Code> groups a set by{' '}
          <Code>{'synchronizerId'}</Code> for inspection.
        </LI>
        <LI>
          <Code>{'assertSingleSynchronizer(contracts)'}</Code> returns the sole{' '}
          <Code>{'synchronizerId'}</Code>, <Code>{'undefined'}</Code> for an empty set, and throws
          listing the distinct ids when the set is mixed. A mixed set means the combined contexts
          span synchronizers and cannot go into one command. A contract caught mid reassignment
          surfaces separately as a <Code>{'409'}</Code> on the registry side per the schema, not
          here.
        </LI>
      </UL>
      <P>
        Broader multi-synchronizer party operations (reassigning contracts, coordinating a party
        across synchronizers) are participant-side operations and stay out of the wallet
        kit{"'"}s scope.
      </P>

      <HR />

      <H2 id="cache-scoping-the-practical-privacy-risk-in-a-dapp">Cache scoping: the practical privacy risk in a dApp</H2>
      <P>
        The ledger scopes reads, but a client cache does not, unless you scope it. If a dApp
        caches a read under a key that does not include the party, then switching the connected
        party can show the previous party{"'"}s data straight out of the cache, before any
        refetch. On Canton, where separation between parties is the point, that is the privacy
        bug most likely to be introduced on the client.
      </P>
      <P>
        The fix is to make the party part of the query key. The tokenization vertical does this
        with a small helper that namespaces every per-party read:
      </P>
      <CodeBlock language="ts">{`// apps/tokenization/src/context/DemoContext.tsx
export function partyKey(scope: string, party: DemoPartyKey): [string, string, DemoPartyKey] {
  return ['tokenization', scope, party];
}

// A per-party read keys on the party, so a different party is a different cache entry:
// key: partyKey('holdings', party)`}</CodeBlock>
      <P>Different party, different key, so there is no cross-party bleed on a switch.</P>
      <P>
        Invalidation then has one rule worth stating, because it is easy to get wrong. The read
        hooks namespace the <Code>{'key'}</Code> you pass under their own key factory, so the real
        TanStack query key is <Code>{'partyLayerKeys.tokenHoldings({ key })'}</Code>, not the raw{' '}
        <Code>{'key'}</Code>. Prefix-invalidating with the raw <Code>{'key'}</Code> silently
        matches nothing. Invalidate through the <Code>{'partyLayerKeys'}</Code> factories instead:
      </P>
      <CodeBlock language="ts">{`// apps/tokenization/src/lib/invalidate.ts
import { partyLayerKeys } from '@partylayer/react/query';

// An empty-args factory call prefix-matches every party's entry:
queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });
queryClient.invalidateQueries({ queryKey: partyLayerKeys.transferInstructions() });
queryClient.invalidateQueries({ queryKey: partyLayerKeys.damlContract() });`}</CodeBlock>
      <P>
        Both verticals are working proof of the pattern: the tokenization app keys holdings,
        instructions, and refs per party and invalidates through <Code>{'partyLayerKeys'}</Code>,
        and the dvp app follows the same discipline for its allocation reads.
      </P>

      <HR />

      <H2 id="see-also">See also</H2>
      <UL>
        <LI><A href="/docs/multi-party-patterns">Multi-party transaction patterns</A></LI>
        <LI><A href="/docs/generic-bridge">Generic Bridge (wallet discovery)</A></LI>
        <LI><A href="/docs/partylayer-and-canton-topology">PartyLayer and Canton Topology</A></LI>
        <LI><A href="https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md">CIP-0056 (Canton Token Standard) specification</A></LI>
      </UL>

      <PrevNext />
    </>
  );
}
