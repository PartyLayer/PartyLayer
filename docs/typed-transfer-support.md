# Typed transfer: per-wallet verdicts

Every wallet in the PartyLayer registry, assessed individually against
`requestTransfer` ([typed transfer](./typed-transfer.md)).

The unit here is the **registry entry**, not the adapter package. There are ten
entries in `registry/v1/stable/registry.json`, and three of them — Cauri, OneSwap
and Walley — arrive through the generic discovery path rather than a
PartyLayer-specific adapter. Arriving generically is a transport fact, not an
answer: each of those three ships its own SDK, and each is assessed on what that
SDK actually exposes.

Each wallet gets exactly one verdict, with the file and line that decides it, and
where it is not supported, the route to changing that.

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

| # | Wallet | Intent-level transfer | Real update id | Explicit approval | Verdict |
|---|---|---|---|---|---|
| 1 | Nightly | yes | yes | yes | **implemented** |
| 2 | Loop | yes | yes | yes | **implemented** |
| 3 | Console | yes | yes | yes | **implemented**, opt-in path only — see below |
| 4 | Send | no | yes | yes | blocked on the standard |
| 5 | Cauri | no | yes | yes | blocked on the standard |
| 6 | Walley | no | yes | yes | blocked on the standard |
| 7 | OneSwap V2 | no | yes (nullable) | yes | blocked on **its own** protocol |
| 8 | WalletConnect | no | yes | yes | blocked on the standard |
| 9 | Cantor8 | yes | **no** | yes | cannot be met |
| 10 | Bron | no | **no** | yes | cannot be met |

Seven of ten already satisfy questions 2 and 3. The binding constraint across the
registry is question 1, and for six of those seven it is not the wallet's doing.

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

### 3. Console — implemented, but on the opt-in path only

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

## Blocked on the standard, not on the wallet

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

**The route, shared:** an intent-level method in CIP-0103. The shape in
[typed transfer](./typed-transfer.md) is a reasonable basis for proposing one —
it is not invented, it is where the CIP-0056 `Transfer` record and three
independent wallet SDKs (Console, Nightly, Loop) already agree. When the standard
has the verb, every wallet in this section gains the capability, and the two
generic paths gain it declaratively through the registry entry's
`adapter.config`, with no per-wallet code — the same way `ledgerApi`, `restore`
and `events` are opted into today (`packages/sdk/src/client.ts:110-137`).

### 4. Send

**Decided by:** `packages/adapters/send/src/types.ts:14` — the `SendRpcMethod`
union is the complete set of methods Send exposes, and its only write verbs are
`prepareExecute` and `prepareExecuteAndWait`.

Send is the best-behaved adapter in the repository on this axis: it already reads
a **real** update id from `prepareExecuteAndWait` and throws, naming the expected
shape, when it is absent (`packages/adapters/send/src/send-adapter.ts:300-306`).
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

### 7. OneSwap V2 Wallet — blocked on its own protocol, not the standard

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

**Route:** OneSwap adds an intent-level method to its popup protocol — a change
entirely within its own control, and the shortest route to a fourth supported
wallet.

**Live question:** is `updateId` ever `null` in practice on a successful
transfer? The type admits it. If it is routinely null, question 2 fails and the
verdict moves to "cannot be met". OneSwap's team can answer this in a sentence;
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

## Cannot be met

### 9. Cantor8 — no ledger update id, and a lossy amount

**Decided by:** `@cantor8/wallet-connect-sdk@0.4.0`, `dist/types.d.ts:153` —
`SubmitTransferResultPayload` is `{ txId: string }` and nothing else.

Cantor8 is the interesting failure, because it is the only wallet here that
answers question 1 **better** than the three that are implemented. Its `send()`
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

**Route:** Cantor8 changes `send()` to accept a decimal string, and returns the
ledger `updateId` (from `send` or from `checkTxStatusById`). Both are changes to
Cantor8's SDK. With those two it becomes the cleanest implementation of the set —
the only one that would not have to narrow `meta`.

### 10. Bron — no execute path at all

**Decided by:** `packages/adapters/bron/src/bron-adapter.ts:86` —
`getCapabilities()` returns `connect`, `disconnect`, `restore`, `remoteSigner`,
`signMessage`, `signTransaction`, `ledgerApi`. There is no `submitTransaction`,
and no submit or execute method anywhere in the package.

Bron is an enterprise remote signer. It signs; it does not submit. Its entire API
client is two operations — `requestSignature` and `pollRequestStatus`
(`packages/adapters/bron/src/api.ts`) — and neither response type carries an
update id (`BronSignResponse`, api.ts:44; `BronRequestStatus`, api.ts:55). The
string `updateId` does not appear in the package.

Question 3 is yes — a human approves or denies in Bron's console
(`status: 'approved' | 'denied'`). Question 2 cannot be satisfied, because
nothing executes.

**Route:** Bron adds a submit/execute endpoint that takes the signed transaction
and returns the ledger update id. That is a change to Bron's service and its API,
not to PartyLayer. Once it exists, this adapter implements `requestTransfer` as
`requestSignature` → execute.

## Deferred, by decision — not dropped

Two follow-ups are known, scoped and deliberately not being done now. They are
recorded here so that neither is rediscovered from scratch later.

### A technical note to OneSwap — pending

**OneSwap is the only wallet in the registry that could add an intent-level
transfer without waiting for CIP-0103.** Every other blocked wallet — Send,
Cauri, Walley, WalletConnect — speaks the official RPC surface, so its method set
is the standard's method set and it cannot grow a verb the standard does not
define. OneSwap's popup surface is a **private protocol**: its wire method is
`canton_prepareSignExecute` (`@oneswap/wallet-cip0103-adapter@0.2.0`,
`dist/index.js:38-39`), not an official RPC, and OneSwap operates both the dApp
adapter and the wallet at the other end of it. Adding a typed transfer there is a
change entirely within its own control, and it already satisfies both hard rules
— a real `updateId` reported separately from `transactionHash`
(`dist/index.d.ts:65-69`) and an explicit popup approval that is re-raised before
every request (`:79-89`). It is therefore the shortest available route to a
fourth supported wallet. A technical note proposing this to the OneSwap team is
**pending and not yet sent**.

One question should travel with that note, because it decides the verdict rather
than refining it: is `updateId` ever `null` on a *successful* transfer? The type
admits it (`updateId: string | null`). If it is routinely null, OneSwap moves
from "blocked on its own protocol" to "cannot be met", and the intent verb would
not be enough on its own.

### The case for a CIP-0103 amendment — pending

An intent-level transfer method in the standard is the single change that would
unblock the most wallets at once. The evidence gathered here is the case for it,
assembled in one place so it can be made without redoing the survey.

**1. The standard has no intent-level transfer, and this is verifiable from its
own published types rather than inferred.**
`@canton-network/core-wallet-dapp-rpc-client@1.4.0` is the canonical dApp API.
Its `RpcTypes` (`dist/index.d.ts:597-654`) defines fourteen methods: `status`,
`connect`, `disconnect`, `isConnected`, `getActiveNetwork`, `prepareExecute`,
`prepareExecuteAndWait`, `signMessage`, `ledgerApi`, `accountsChanged`,
`getPrimaryAccount`, `listAccounts`, `txChanged`, `messageSignature`. None of
them is a transfer.

**2. Both write verbs take a prepared command body.** `prepareExecute` and
`prepareExecuteAndWait` both take `PrepareExecuteParams`
(`dist/index.d.ts:492-500`), whose `commands` field is documented as "a non-empty
array of Daml command atoms" (`:61`). A dApp using the standard as it stands must
therefore construct Daml commands, which means either the dApp or the connection
layer becomes a ledger client. `PrepareExecuteParams` also accepts `actAs`,
letting the caller name the acting party.

**3. Seven of ten registry wallets already satisfy both hard rules.** Nightly,
Loop, Console, Send, Cauri, Walley and OneSwap all return a real ledger update id
and all show an explicit user approval. The capability is not the obstacle.

**4. Six of those seven are blocked by nothing except the missing verb.** Only
Nightly and Loop reach a typed transfer today, and they do so through their own
proprietary SDK methods, outside the standard. Console reaches one the same way,
but only on the opt-in adapter path. The rest have everything the contract needs
except a way for an application to express what it wants.

**5. Walley is the proof that the gap is the standard's and not any wallet's.**
`@k2flabs/walley-dapp-sdk@1.2.0` is a pure standards implementation:
`request<M extends keyof RpcTypes>` (`dist/index.d.ts:98`) is type-bound to the
official method set, its handlers are exactly that set, and the strings
`transfer`, `amount` and `instrument` do not appear anywhere in its type surface.
A wallet that implements CIP-0103 faithfully and completely still cannot offer a
typed transfer — because there is nothing in CIP-0103 to implement. That is the
argument in one wallet.

**6. The shape is already agreed in practice, so the amendment does not have to
invent one.** The intent in [typed transfer](./typed-transfer.md) is where the
CIP-0056 Canton Token Standard `Transfer` record and three independent wallet
SDKs converge: Console's `SignSendRequest` (`to` / `token` / `amount` / `memo`),
Nightly's `CreateTransferCommandParams` (`receiverPartyId` / `instrument` /
`amount` / `memo` / `expiryDate`), and Loop's
`transfer(recipient, amount, instrument, options)`. Cantor8's `send()` agrees too
and goes further, carrying a full `metadata` map. Four wallet vendors arrived at
substantially the same parameters independently.

**7. The standard already solves the harder half.** `prepareExecuteAndWait`
returns `PrepareExecuteAndWaitResult = { tx: TxChangedExecutedEvent }`
(`dist/index.d.ts:533-535`) whose payload is `{ updateId, completionOffset }`
(`:292-305`). A real ledger update id is already specified and already flowing.
An intent-level verb could reuse that result type unchanged; only the request
side is missing.

Two design points worth carrying into any proposal, both learned here: the
acting party should come from the session rather than a caller-supplied `actAs`,
and the request should not carry input holding contract ids — the wallet chooses
which of its own holdings to spend. The reasoning for both is in
[typed transfer](./typed-transfer.md).

## Live verification: what still needs a wallet

Everything above is established from source and unit tests. Three things can only
be established with a real wallet, a browser and devnet, and they are the same
three for each implemented adapter:

1. the user is shown a confirmation naming the recipient, the instrument, the
   amount and the memo — and can decline it;
2. declining surfaces as `UserRejectedError`, not a hang or a silent success;
3. the returned `updateId` is a real ledger update id.

Because (3) is the claim most easily believed and hardest to check, verify it
against the ledger rather than against the wallet's own display. The update id
should resolve through your validator's JSON API:

```
GET /v2/updates/{updateId}
```

If it does not resolve, the value is not an update id, whatever the field is
called — and that is exactly the failure this method exists to prevent.

### Procedure, per wallet

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
  OneSwap is "blocked on its own protocol" or "cannot be met".
- **Send: does the provider accept any method beyond the eleven modelled?**
  Decides whether Send is blocked at all.
