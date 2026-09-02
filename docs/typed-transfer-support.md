# Typed transfer: integration status

Which wallets in the PartyLayer registry `requestTransfer`
([typed transfer](./typed-transfer.md)) works with today, and for the ones it does
not, what in the integration is missing.

This is a status matrix for people building on PartyLayer, so that a dApp can
tell in advance which wallets will offer the action. It is not an assessment of
anyone's product. Where a limitation sits in a wallet's own SDK it is cited to
that SDK's published types, so the statement can be checked — and rechecked, since
a release can change it and this page will lag.

The unit is the **registry entry**, not the adapter package. There are ten entries
in `registry/v1/stable/registry.json`, and three of them — Cauri, OneSwap and
Walley — arrive through the generic discovery path rather than a
PartyLayer-specific adapter. Arriving generically is a transport fact, not a
status: each of those three ships its own SDK, and each is read against it.

Every entry carries the file and line the status is read from. Where the source is
one of our own adapters rather than the wallet's SDK, that is said explicitly,
because the two support very different conclusions.

## The three questions

For each wallet:

1. **Does its own SDK expose an intent-level transfer** — receiver, amount,
   instrument — as opposed to a prepared command body?
2. **Does it return a real ledger update id**, as opposed to a submission id, a
   command id, or its own transaction handle?
3. **Does it show an explicit user approval** the user can decline?

An adapter implements `requestTransfer` only if all three are yes. A wallet that
can do some but not all declares `transfer: false`. Partial support is worse than
none: the whole point is that the result can be trusted as evidence and that a
human saw what they authorised.

## Summary

| # | Wallet | Intent-level transfer | Real update id | Explicit approval | Status |
|---|---|---|---|---|---|
| 1 | Nightly | yes | yes | yes | **implemented** |
| 2 | Loop | yes | yes | yes | **implemented** |
| 3 | Console | yes | yes | yes | **implemented** (opt-in adapter path) |
| 4 | Send | no | yes | yes | not available — standard |
| 5 | Cauri | no | yes | yes | not available — standard |
| 6 | Walley | no | yes | yes | not available — standard |
| 7 | OneSwap V2 | no | yes (nullable) | yes | not available — provider protocol |
| 8 | WalletConnect | no | yes | yes | not available — standard |
| 9 | Cantor8 | yes | **no** | yes | not available — SDK |
| 10 | Bron | not integrated | not integrated | yes | not available — our adapter |

Seven of ten already satisfy questions 2 and 3, so the usual blocker is question
1 — a way for an application to express the intent — and for six of those seven
that is the standard's shape rather than anything the wallet chose.

Bron is the one row whose answer is about our integration rather than the wallet:
we implemented signing and never implemented submission, so questions 1 and 2 are
"not integrated" rather than "not possible". See §10.

## Implemented

### 1. Nightly

`packages/adapters/nightly/src/nightly-adapter.ts`

The closest fit in the registry. `createTransferCommand` takes the intent almost
verbatim (`receiverPartyId`, `amount`, `instrument`, `memo`, `expiryDate`) and is
the only wallet here that carries the instrument's **admin** through, so the
confirmation can name the issuer and not just the symbol.
`submitTransactionCommand` reports an explicit approve or reject and returns the
real `updateId` on approval.

Served by the built-in adapter on the default path
(`packages/sdk/src/builtin-adapters.ts:41`), so this is live for any dApp that
does not override the adapter list.

`meta` is narrowed to a single `memo`; a wider map is refused.

### 2. Loop

`packages/adapters/loop/src/loop-adapter.ts`

The SDK's own `transfer(recipient, amount, instrument, options)` in
`executionMode: 'wait'` — the mode in which `RunTransactionResponse.update_id` is
populated at all. `TransferOptions` carries both `memo` and `executeBefore`, so
the deadline maps with nothing invented.

Served by the built-in adapter on the default path
(`packages/sdk/src/builtin-adapters.ts:40`).

The pre-existing `submitTransaction` on this adapter reports
`submission_id ?? command_id` as its `updateId`
(`packages/adapters/loop/src/loop-adapter.ts:490`). Neither is an update id; the
real field was unread in the SDK's own response type. `requestTransfer` reads it.

### 3. Console — implemented, on the opt-in adapter path only

`packages/adapters/console/src/console-adapter.ts`

The wallet can do all three. `submitCommands` is itself a typed transfer
(`from`/`to`/`token`/`amount`/`expireDate`/`memo`), the popup takes an explicit
approval, and the `txChanged` stream carries the real update id, correlated to
the call by signature.

**The qualification that matters.** Console's registry entry is
`adapter.transport: "announce"`, and `ConsoleAdapter` was removed from the
default built-in list for exactly that reason
(`packages/sdk/src/builtin-adapters.ts:43-45`). On the default path Console is
therefore driven by `GenericAnnounceAdapter`, which has no `requestTransfer`. So:

- a dApp that passes `adapters: [new ConsoleAdapter()]` gets the typed transfer;
- a dApp that relies on the registry gets Console over the announce path, where
  the capability is absent — correctly, since the generic path cannot offer it.

This is worth knowing before assuming the default Console experience includes it.
Closing the gap needs the same standard-level change as the four below, not more
adapter code.

Two intent fields Console cannot carry are refused rather than dropped: an absent
`executeBefore` (its `expireDate` is required, and inventing a deadline the user
is then shown would be putting words in their mouth) and a `meta` map that is not
a single `memo`.

Open against a live wallet: `SignSendRequest` has `token: string` and no admin
field, so the issuing admin does not reach the wallet on this path.

## Not available: the standard has no intent-level verb

Five wallets — Send, Cauri, Walley, WalletConnect and both generic paths — share
one cause. Each is still assessed on its own SDK below, because sharing a cause
is not the same as being dismissed by category.

**The cause, from the standard's own published types.**
`@canton-network/core-wallet-dapp-rpc-client@1.4.0` is the canonical CIP-0103
dApp API. Its `RpcTypes` (`dist/index.d.ts:597-654`) defines **fourteen methods**:
`status`, `connect`, `disconnect`, `isConnected`, `getActiveNetwork`,
`prepareExecute`, `prepareExecuteAndWait`, `signMessage`, `ledgerApi`,
`accountsChanged`, `getPrimaryAccount`, `listAccounts`, `txChanged`,
`messageSignature`.

There is no intent-level transfer among them. The only two write verbs both take
`PrepareExecuteParams` (`dist/index.d.ts:492-500`):

```ts
export interface PrepareExecuteParams {
    commandId?: CommandId;
    commands: Commands;          // "Non-empty array of Daml command atoms" (:61)
    actAs?: ActAs;
    readAs?: ReadAs;
    disclosedContracts?: DisclosedContracts;
    synchronizerId?: SynchronizerId;
    packageIdSelectionPreference?: PackageIdSelectionPreference;
}
```

A prepared command body, not an intent. (Note it also takes `actAs` — the caller
naming the acting party — which is one of the things `TransferIntent`
deliberately does not let a caller do.)

The good news in the same file: `prepareExecuteAndWait` returns
`PrepareExecuteAndWaitResult = { tx: TxChangedExecutedEvent }`
(`dist/index.d.ts:533-535`), whose payload is `{ updateId, completionOffset }`
(`:292-305`). **A real update id is already in the standard.** Question 2 is
solved; question 1 is not.

PartyLayer could bridge question 1 only by building the Daml command itself —
fetching a transfer factory and a choice context, becoming a ledger client. It is
not one, and the boundary is deliberate
([PartyLayer and Canton topology](./partylayer-and-canton-topology.md)). Doing it
would be the same class of mistake as opening `ledgerApi`: moving work into the
layer that must not understand it.

**What would change this:** an intent-level method in CIP-0103. If the standard
gains one, every wallet in this section gains the capability, and the two generic
paths pick it up declaratively through the registry entry's `adapter.config`,
with no per-wallet code — the same way `ledgerApi`, `restore` and `events` are
opted into today (`packages/sdk/src/client.ts:110-137`).

### 4. Send

**Decided by:** `packages/adapters/send/src/types.ts:14` — the `SendRpcMethod`
union is the complete set of methods Send exposes, and its only write verbs are
`prepareExecute` and `prepareExecuteAndWait`.

Our Send adapter already reads a **real** update id from `prepareExecuteAndWait`
and throws, naming the expected shape, when it is absent (`packages/adapters/send/src/send-adapter.ts:300-306`).
Passkey approval, mapped to `UserRejectedError` on cancel. Questions 2 and 3: yes.

Like Console, its registry entry is `transport: "announce"` and `SendAdapter` is
not in the default built-in list (`packages/sdk/src/builtin-adapters.ts:46-48`).

**Live question:** does Send's `window.canton.request` accept any method beyond
the eleven modelled at types.ts:14? That union is PartyLayer's model of Send's
protocol, not Send's own manifest. Answering it needs the extension installed and
an introspection call against a real provider — or a one-line answer from the
Send team.

### 5. Cauri

**Decided by:** `@lithiumdigital/cauri-dapp-sdk@0.2.0`, `dist/index.js:314-328` —
`CauriProvider.request()` dispatches exactly eleven methods and ends
`default: throw new Error("CauriProvider: method '...' is not implemented")`.
Nothing is hidden behind the types: `request<M extends keyof DappRpcTypes>`
(`dist/provider.d.ts`) is type-constrained to the official CIP-0103 method set,
so it *cannot* accept an intent method without changing the standard it binds to.

Questions 2 and 3 are both yes, and Cauri answers them unusually well:

- **Real update id.** `doPrepareExecuteAndWait` (`dist/index.js:484`) opens the
  approval popup, then `waitForTerminalTx(commandId)` (`:448`) resolves on the
  `txChanged` event with `status === "executed"` (`:456-458`), which is the
  official `TxChangedExecutedEvent` carrying `payload.updateId`.
- **Explicit approval, with the failure modes separated.**
  `CauriUserRejectedReason` is `'rejected' | 'timeout' | 'popup_closed' | 'popup_blocked'`
  (`dist/rpc.d.ts:19`) and `USER_REJECTED_CODE = 4001` (`:21`). A declined
  approval, a timeout and a closed window are three distinguishable outcomes,
  which is more than most.

It has no intent-level transfer because it implements the standard and the
standard has none.

### 6. Walley

**Decided by:** `@k2flabs/walley-dapp-sdk@1.2.0`, `dist/index.d.ts:98` —
`WalleyProvider.request<M extends keyof RpcTypes>` is bound to the official
`RpcTypes`, and its private handlers (`:99-116`) are exactly the standard set:
connect, disconnect, status, isConnected, listAccounts, getPrimaryAccount,
getActiveNetwork, signMessage, prepareExecute, prepareExecuteAndWait, ledgerApi.

**The hypothesis worth testing explicitly, and its answer.** Console, Nightly and
Loop each turned out to have an intent-level transfer sitting unused in their own
SDK, so it was reasonable to expect the same of Walley, which likewise ships its
own SDK. It does not. The strings `transfer`, `amount` and `instrument` do not
appear anywhere in `dist/index.d.ts`. Walley is a pure standards implementation —
which is precisely *why* it has no intent verb: it has exactly what CIP-0103
defines and nothing beyond it.

Questions 2 and 3: yes. `handlePrepareExecuteAndWait` (`:111`) returns the
official `PrepareExecuteAndWaitResult` with its real `updateId`, and
`DEFAULT_REQUEST_TIMEOUT_MS` is documented as "a wall-clock bound on a single
popup request, **including time spent waiting for the user to approve**"
(`:43-44`) — an explicit approval by construction.

### 7. OneSwap V2 Wallet — its protocol is its own, not CIP-0103

**Decided by:** `@oneswap/wallet-cip0103-adapter@0.2.0`, `dist/index.d.ts:65` —
`prepareSignExecute(commands: unknown[])`, aliased as `submitTransaction` at `:71`.
Its provider rejects a call with no commands
(`dist/provider.js:97`: "commands must be a non-empty array of Daml commands")
and rejects unknown methods outright (`:103`, code 4200).

OneSwap is the one wallet in this section whose route does **not** run through
CIP-0103. Its popup surface is a **private protocol** — the wire method is
`canton_prepareSignExecute` (`dist/index.js:38-39`), not an official RPC — and
OneSwap owns both ends of it. It could add an intent-level method to its own
popup protocol without waiting for the standard.

Questions 2 and 3, both yes, and this is why it was worth checking first:

- **Real update id, reported separately from the transaction hash.**
  `prepareSignExecute` returns `{ transactionHash: string; updateId: string | null; submittedAt: string }`
  (`dist/index.d.ts:65-69`). That the two are distinct fields is the meaningful
  part: OneSwap is not passing a hash off as an update id.
- **Explicit approval, and thought about.** Every request re-establishes *and
  raises* the popup before sending, with a documented rationale
  (`dist/index.d.ts:79-89`): an integrator reported approvals "sitting unnoticed
  in a background tab with no indication anything was waiting".

**What would change this:** an intent-level method on OneSwap's own popup
protocol. Because that protocol is private rather than CIP-0103, it does not
depend on the standard moving.


**Live question:** is `updateId` ever `null` in practice on a successful
transfer? The type admits it. If it is routinely null, question 2 fails and the
status moves to "not available — SDK". OneSwap's own team could answer this;
otherwise it needs a devnet transfer through the popup.

### 8. WalletConnect

**Decided by:** `packages/adapters/walletconnect/src/walletconnect-adapter.ts:408-419`
— `submitTransaction` issues `prepareExecuteAndWait` with `params.signedTx` passed
through as the command body. The `canton_` namespace mirrors CIP-0103, so it
inherits the standard's gap exactly.

Question 2 is available in principle — the response has the same
`tx.payload.updateId` shape — but the adapter currently falls back to
`result?.tx?.commandId ?? 'pending'` and returns the literal string `pending` as a
`transactionHash` (`:418`). Tracked in the placeholder-values issue, not here.

**Live question:** which `canton_*` methods does a given remote wallet advertise
in its WalletConnect session namespace? That is per-wallet and negotiated at
pairing time; it cannot be read from this repository. It needs a live pairing and
an inspection of the approved session.

### The two generic paths

Not registry entries themselves, but how five of the entries above are driven.

**Decided by:** `packages/sdk/src/announce-adapter.ts:323-334` and
`packages/sdk/src/discovery-adapter.ts:326-335` — both implement
`submitTransaction` as a single `prepareExecute` RPC with the caller's opaque
params. They can offer exactly what the standard defines.

Both already report `transfer` absent with no change needed: the announce
adapter's `getCapabilities()` includes an optional method only when it was
assigned (`announce-adapter.ts:217`), and discovery's is a fixed baseline
(`discovery-adapter.ts:191`). Neither lists it.

Both adapters now negotiate the execute verb rather than assuming one. The
standard types `prepareExecute` as `(params) => Promise<Null>`
(`core-wallet-dapp-rpc-client@1.4.0/dist/index.d.ts:586`) while
`prepareExecuteAndWait` on the next line returns a real result, so they prefer
the awaited verb and fall back only for a wallet that does not implement it —
OneSwap being the one in this registry. See
`packages/sdk/src/prepare-execute.ts`.

## The double-submit hazard

**A fallback on a submit path issues a second submit.** That is the constraint
governing any retry, alternative verb, or degradation added to a submit path in
this repository, and it will outlive the change that prompted writing it down.

The negotiation above is the current instance. It calls
`prepareExecuteAndWait`, and when the wallet does not have that method it calls
`prepareExecute` instead. Those are two submissions of the same transaction, and
only one thing makes the second one safe: the first was rejected as a *method*,
so nothing ever reached the ledger.

**The rule.** A fallback fires only on a coded unsupported-method error —
CIP-0103's `4200` or JSON-RPC's `-32601`. A user rejection (`4001`), a timeout,
and any uncoded failure re-throw rather than retrying.

**The reason.** A loose trigger puts the same transaction in front of a user
twice. If a decline were treated as "try the other verb", the wallet would
re-prompt for a transfer the person had just refused, and a second prompt is
something a user may approve out of confusion. Surfacing an error is strictly
better than that.

The same rule covers a subtler case. When the awaited verb *succeeds* but returns
no update id, the response is returned as it is and the other verb is not tried —
the transaction is already committed, and a thin receipt is a far smaller problem
than a duplicate transfer.

The cost of the rule is a known, narrow gap, recorded here so it is a decision
rather than an oversight: a wallet that lacks the awaited verb *and* signals that
with an uncoded error will fail where it would previously have worked. No wallet
in this registry does that — OneSwap throws a proper `4200`, and the other four on
these paths implement the method. It applies only to an unknown announcing
wallet, for which the pre-negotiation behaviour was already the broken one.

Tests pin all three behaviours in `packages/sdk/src/prepare-execute.test.ts`,
under "it never submits twice". They are the most load-bearing tests in that
file: everything else there is about correctness of a value, and these are about
not moving someone's money twice.

## Not available: the wallet SDK cannot express the contract

### 9. Cantor8 — no ledger update id in the SDK, and a numeric amount

**Decided by:** `@cantor8/wallet-connect-sdk@0.4.0`, `dist/types.d.ts:153` —
`SubmitTransferResultPayload` is `{ txId: string }` and nothing else.

Cantor8 answers question 1 more completely than the three that are implemented:
its `send()`
takes `senderPartyId`, `instrumentId`, `receiverPartyId`, `memo` **and a full
`metadata` map** (`dist/provider.d.ts:18-25`) — the only wallet in the registry
that could carry `TransferIntent.meta` without narrowing it to a single memo.

It fails on the other two axes, independently:

1. **No update id.** The SDK's whole surface exposes only `txId`
   (`SubmitTransferResultPayload` at types.d.ts:153,
   `TransferTransactionPayload.txId` at :145, the `txChanged` event at :23).
   `txId` is Cantor8's own handle, consumed by its own `checkTxStatusById`.
   Nothing maps to a Canton `updateId` or `completionOffset`, and `updateId` does
   not appear in the adapter package either.
2. **Amount is a JS number.** `send()` takes `amount: number`
   (`dist/provider.d.ts:21`). Converting a decimal-string amount to a JS number
   is the lossy coercion `toTransferIntent` exists to refuse; it can silently
   change the amount the user is shown and approves.

Question 3 is yes: `signAndExecute` prompts in the wallet, and `txChanged`
reports the outcome.

**What would change this:** an SDK that accepts a decimal string for `amount`
and surfaces a ledger `updateId`. Both are on the Cantor8 side, so this entry
stays as-is until a release changes those types.

## Not available: not integrated

### 10. Bron

**Status: not supported. What our adapter can do is established; what the service
can do is not.**

**Decided by:** `packages/adapters/bron/src/bron-adapter.ts:86` —
`getCapabilities()` returns `connect`, `disconnect`, `restore`, `remoteSigner`,
`signMessage`, `signTransaction`, `ledgerApi`. There is no `submitTransaction`,
and no submit or execute call anywhere in the package. Our API client covers two
operations, `requestSignature` and `pollRequestStatus`
(`packages/adapters/bron/src/api.ts`), and neither response type carries an
update id (`BronSignResponse`, api.ts:44; `BronRequestStatus`, api.ts:55).

An explicit approval is present: `status: 'approved' | 'denied'` comes from a
human acting in Bron's own interface.

**What is NOT established, and was previously stated here as though it were.** An
earlier revision of this section said Bron "signs; it does not submit", and
listed what Bron should add to their service. Neither claim was sourced from
anything Bron publishes. This package has no Bron dependency —
`packages/adapters/bron/package.json` requires only `@partylayer/core` — so
`api.ts` is our own hand-written model of the parts of their API we integrated.
An adapter that implements no submit path is evidence about the adapter. Whether
their service exposes one is **unknown to us, because we never integrated it.**

**To move this forward** the question is ours to ask, not theirs to answer
unprompted: does the Bron API expose a submit or execute call that returns a
ledger update id? Their API documentation or their team would settle it. If it
does, this adapter can implement `requestTransfer` on top of the existing
`requestSignature` flow.

## Live verification: what still needs a wallet

Everything above is established from source and unit tests. Three things can only
be established with a real wallet, a browser and devnet, and they are the same
three for each implemented adapter:

1. the user is shown a confirmation naming the recipient, the instrument, the
   amount and the memo — and can decline it;
2. declining surfaces as `UserRejectedError`, not a hang or a silent success;
3. the returned `updateId` is a real ledger update id.

Because (3) is the claim most easily believed and hardest to check, verify it
against the ledger rather than against the wallet's own display.

Two checks. First, shape: **a Canton update id is a 64-character hexadecimal
string**, which alone catches every fabricated value this codebase has produced.
Second, a ledger lookup by that id — if it does not resolve, the value is not an
update id whatever the field is called, and that is exactly the failure this
method exists to prevent.

An earlier revision of this section named `GET /v2/updates/{updateId}` as the
lookup route. That was not sourced from anything: this repository never reads an
update by id, so there is no verified route here, and the JSON Ledger API differs
across versions. The claim has been removed rather than left to be copied. See
[the devnet runbook](./DEVNET-RUN.md) for what to establish about your own
validator before running the check.

### Procedure, per wallet

The step-by-step version, including the page to run and the file to create, is in
[docs/DEVNET-RUN.md](./DEVNET-RUN.md). What follows is the short form.

With the wallet connected to devnet and holding a small balance:

```ts
const { updateId, commandId } = await client.requestTransfer({
  receiver: '<a second party you control>',
  amount: '0.01',
  instrumentId: { admin: '<the instrument admin>', id: '<the instrument id>' },
  meta: { memo: 'requestTransfer live check' },
  executeBefore: new Date(Date.now() + 3600_000).toISOString(),
});
```

Record, for each of Nightly, Loop and Console: what the confirmation actually
displayed (a screenshot is the useful artefact), the `updateId` returned, whether
it resolves on the ledger, and what a declined approval produced.

For Console, remember to pass `adapters: [new ConsoleAdapter()]` — the registry
path does not carry this method.

Then repeat with a deliberately malformed intent — `amount: 0.01` as a number —
and confirm it is refused before the wallet is ever opened.

### Open questions a live run or a wallet team would settle

- **Console: does the confirmation name the issuing admin?** `SignSendRequest`
  has `token: string` and no admin field. If Console resolves the token against
  its own registry the display is fine; if two instruments can share an id across
  admins, this needs a different mapping.
- **Console: does the signature correlation hold?** The adapter matches the
  `signed` event's `payload.signature` against the value `submitCommands`
  returns. If the live wallet does not populate both identically, the adapter
  falls back to a single in-flight command and otherwise refuses.
- **Loop: does `transfer()` in `wait` mode always populate `update_id` on
  success?** The SDK types it optional. The adapter throws when it is absent, so
  the failure is safe — but if it is routinely absent, the mapping needs
  revisiting.
- **OneSwap: is `updateId` ever null on a successful transfer?** Decides whether
  this entry stays "not available — provider protocol" or moves to "not available — SDK".
- **Send: does the provider accept any method beyond the eleven modelled?**
  Decides whether Send is blocked at all.
