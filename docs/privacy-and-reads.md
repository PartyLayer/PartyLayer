# Privacy-aware reads on Canton

On Canton the ledger itself enforces what a party can see. A contract is only visible
to the parties that are stakeholders on it, so a wallet kit does not filter privacy on
the client. The job is not to hide data that arrived; it is to read the right slice and
to key caches per party so one party never sees another's cached reads.

This guide covers how PartyLayer's read surface lines up with Canton's visibility
model, and the one place where a dApp can still leak across parties by accident: cache
scoping.

---

## Witness-based visibility: the ACS is already scoped

A party's active-contract set (ACS) contains only the contracts that party is a
stakeholder on (a signatory or observer). That is a ledger property, the same one the
[topology guide](./partylayer-and-canton-topology.md) leans on when it says a package
must be vetted on every participant that hosts a stakeholder party. An ACS read for a
party therefore comes back already privacy-scoped: the participant will not return a
contract the party cannot witness.

The consequence for a dApp is that there is nothing to post-filter for privacy. When a
read returns a set of contracts, that set is what the party is entitled to see. You do
not run a client-side allow-list over it to remove other parties' data, because that
data never arrived in the first place. Client-side filtering is for the app's own view
concerns (sorting, paging, "hide zero balances"), not for privacy.

---

## Interface views are the disclosure decomposition

The Canton Token Standard (CIP-0056) exposes each contract through a Daml interface
view: `HoldingView`, `TransferInstructionView`, `AllocationView`, and
`AllocationRequestView`. The view is the shape a counterparty is meant to see, which is
exactly what makes it the right read target. You read the interface, not the underlying
registry-specific template, so your code depends on the standardized disclosed shape
rather than on Amulet internals.

PartyLayer's typed read hooks map one to one onto those views:

| Interface view | Read hook |
| --- | --- |
| `HoldingView`            | `useTokenHoldings`       |
| `TransferInstructionView`| `useTransferInstructions`|
| `AllocationView`         | `useTokenAllocations`    |
| `AllocationRequestView`  | `useAllocationRequests`  |

Each hook returns contract refs, not bare views: a `{ cid, view }` pair where `cid` is
the ACS contract id and the view is the typed disclosed shape (for holdings the ref is
`{ cid, holding }`, for instructions `{ cid, instruction }`, and so on). The `cid` is
kept because the write side needs it: it is what a later choice is exercised on, or
what feeds `inputHoldingCids` on a transfer. The view is what you render.

These hooks are Model 2 reads: they wrap a fetcher you supply, so the ledger read runs
through your own Ledger API or JSON API, and the ledger scopes it. PartyLayer is not a
ledger client and does not widen what the fetcher returns.

---

## Observers by design: how discovery is granted

Some contracts are meant to be found by a counterparty that is not a signatory. The
allocation-request flow is the clearest case. The standard states that a settlement
app's implementation SHOULD make at least all senders of the transfer legs observers of
the `AllocationRequest`, so those senders' wallets discover the pending request through
an ordinary ACS read. Visibility here is a deliberate topology choice by the settlement
app, not something the wallet kit arranges.

Because visibility is granted per party, the request a given party sees MAY be a partial
picture. The `transferLegs` on an `AllocationRequest` view may or may not be the
complete list of the settlement's legs, depending on the confidentiality requirements
of the app: a party can be made an observer that sees only the legs it needs to act on.
A dApp reading `useAllocationRequests` should treat `transferLegs` as "the legs this
party can see", not "every leg in the settlement".

---

## Explicit disclosure for the other direction

Witness-based visibility covers what a party can read. The reverse direction, showing a
counterparty's participant a contract it is not a stakeholder on so that a choice can
reference it, is handled by explicit disclosure rather than by widening visibility. When
a registry answers a factory or choice-context request, it hands back the reference data
as disclosed contracts alongside the context that refers to them.

PartyLayer types these wire shapes in the `/query` entrypoint:

- `TokenDisclosedContract`: one contract disclosed to the participant, carrying its
  `templateId`, `contractId`, `createdEventBlob`, and a required `synchronizerId` (the
  synchronizer the contract is currently assigned to). Its `debugPackageName`,
  `debugPayload`, and `debugCreatedAt` are provider hints to trust ONLY if you trust
  the provider, since they may not match the `createdEventBlob`.
- `TokenChoiceContext`: the `choiceContextData` plus the `disclosedContracts` it refers
  to by contract id.
- `mergeDisclosedContracts(...lists)`: combines the disclosures of several registry
  contexts (for example a factory context plus a per-action choice context) into one
  submission's disclosed contracts, deduplicating by `contractId` with the first
  occurrence winning.

Because a single submission's disclosed contracts must all live on one synchronizer,
two helpers validate a combined set before you build the command:

- `groupDisclosedContractsBySynchronizer(contracts)` groups a set by `synchronizerId`
  for inspection.
- `assertSingleSynchronizer(contracts)` returns the sole `synchronizerId`, `undefined`
  for an empty set, and throws listing the distinct ids when the set is mixed. A mixed
  set means the combined contexts span synchronizers and cannot go into one command. A
  contract caught mid reassignment surfaces separately as a `409` on the registry side
  per the schema, not here.

Broader multi-synchronizer party operations (reassigning contracts, coordinating a
party across synchronizers) are participant-side operations and stay out of the wallet
kit's scope.

---

## Cache scoping: the practical privacy risk in a dApp

The ledger scopes reads, but a client cache does not, unless you scope it. If a dApp
caches a read under a key that does not include the party, then switching the connected
party can show the previous party's data straight out of the cache, before any refetch.
On Canton, where separation between parties is the point, that is the privacy bug most
likely to be introduced on the client.

The fix is to make the party part of the query key. The tokenization vertical does this
with a small helper that namespaces every per-party read:

```ts
// apps/tokenization/src/context/DemoContext.tsx
export function partyKey(scope: string, party: DemoPartyKey): [string, string, DemoPartyKey] {
  return ['tokenization', scope, party];
}

// A per-party read keys on the party, so a different party is a different cache entry:
// key: partyKey('holdings', party)
```

Different party, different key, so there is no cross-party bleed on a switch.

Invalidation then has one rule worth stating, because it is easy to get wrong. The read
hooks namespace the `key` you pass under their own key factory, so the real TanStack
query key is `partyLayerKeys.tokenHoldings({ key })`, not the raw `key`. Prefix-
invalidating with the raw `key` silently matches nothing. Invalidate through the
`partyLayerKeys` factories instead:

```ts
// apps/tokenization/src/lib/invalidate.ts
import { partyLayerKeys } from '@partylayer/react/query';

// An empty-args factory call prefix-matches every party's entry:
queryClient.invalidateQueries({ queryKey: partyLayerKeys.tokenHoldings() });
queryClient.invalidateQueries({ queryKey: partyLayerKeys.transferInstructions() });
queryClient.invalidateQueries({ queryKey: partyLayerKeys.damlContract() });
```

Both verticals are working proof of the pattern: the tokenization app keys holdings,
instructions, and refs per party and invalidates through `partyLayerKeys`, and the dvp
app follows the same discipline for its allocation reads.

---

## See also

- [Multi-party transaction patterns](./multi-party-patterns.md)
- [Generic Bridge (wallet discovery)](./generic-bridge.md)
- [PartyLayer and Canton Topology](./partylayer-and-canton-topology.md)
- [CIP-0056 (Canton Token Standard) specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md)
