# Open findings

Verified defects that are **not fixed** and **not scheduled**. Each entry says
what reproduces, on what commit it was checked, and what would have to happen to
close it.

## Why this file exists

A defect written up only in a report is a defect that gets rediscovered. Two of
the entries below came from an external consumer who found them because nothing
in the tree said they were known.

The sharper reason is #6. Work already in flight touches the same subject and
will look, when it lands, as though it closed this. It does not. A register is
how "we fixed the neighbouring thing" stops reading as "we fixed it".

**An entry leaves this file when the defect is fixed, not when it is explained.**
If you are about to add reasoning to an entry rather than remove it, that is the
signal it should have a decision made instead.

---

## 1. Nothing filters on `supportedNetworks`

**Reproduces** on `55ff8d1`. Send declares `supportedNetworks: ["mainnet"]` and is
offered in the demo's picker, which runs `network="devnet"`.

The field is validated in `packages/registry-client/src/schema.ts` and mapped to
`WalletInfo.networks`, and then **read by nothing**: zero consumers across
`packages/sdk`, `packages/react` and `packages/core`. It is populated and dead.

**What would close it** is a decision, not code. Either the picker filters by
declared network, or the app does. Filtering in the picker hides wallets a dApp
may deliberately want to offer — a devnet demo listing a mainnet-only wallet is
arguably correct for a demo. Leaving it to the app means every consumer
reimplements the same filter. Until that is settled the honest state is a dead
field, which is better than filtering on a default nobody chose.

## 2. No way to observe an in-progress wait

**Reproduces** on `55ff8d1`. The client emits `session:connected`,
`session:disconnected`, `session:expired`, `session:networkMismatch`,
`wallets:changed`, `tx:status` and `error`. There is no pending or progress
event. `phase` appears only inside **error** payloads — after the fact, on
failure.

A consumer can learn that a wait failed and where. It cannot ask what is being
waited on now. `#326` bounded the connect deadline at 120s, which is a different
question: bounded is not observable.

**What would close it** is an event we have not designed. Our event surface is
public API, so this needs a defined vocabulary and stable semantics rather than a
debug hook bolted on — which is why it is not a patch.

## 3. `GenericDiscoveryAdapter` reports a hard-coded capability list

**Reproduces** on `55ff8d1`.
`packages/sdk/src/discovery-adapter.ts` returns
`['connect', 'disconnect', 'signMessage', 'submitTransaction']` regardless of
what the wallet's SDK exposes. That list is returned from `connect()` and stored
as `session.capabilitiesSnapshot` — which `client.ts`'s own JSDoc tells consumers
to query (`session.capabilitiesSnapshot.includes('transfer')`).

Walley's SDK documents a bearer token "for `ledgerApi` calls" and implements both
`prepareExecute` verbs. A consumer following our documented guidance is told
neither exists.

**READ THIS BEFORE ASSUMING THE REGISTRY WORK CLOSED IT.** The `connect` field
and the four added capabilities (`transfer`, `ledgerApi`, `popup`, `restore`)
improve `WalletInfo.capabilities` — what the **picker** shows. They do not touch
the adapter's hard-coded list, so `capabilitiesSnapshot` will still say
`ledgerApi` is absent for Walley after the registry entries land. Two surfaces;
one of them is fixed.

**What would close it** is the adapter deriving its capabilities from the same
source the picker reads, rather than returning a constant.

---

## Recently closed, for contrast

Kept briefly so the register shows the difference between "explained" and
"fixed".

- **Console probe conflated timeout with absence** — `#335`. The vendor resolves
  `notInstalled` on a 1000ms timeout and caches it for the page; our `unknown`
  branch sat in a `catch` the vendor never triggers, so it never ran.
- **Loop discarded the transaction outcome and declared a false `events`
  capability** — `#336`.
