# Typed transfer: per-wallet verdicts

Every wallet PartyLayer supports, assessed against `requestTransfer`
([typed transfer](./typed-transfer.md)). Each has exactly one verdict, the file
and line that decides it, and — where it is not supported — the route to changing
that.

Nothing here is left at "not looked at". A wallet that does not implement the
method has a named reason.

## The bar

An adapter implements `requestTransfer` only if it can do **both**:

1. return a **real ledger update id**, and
2. show the user an **explicit approval** they can decline.

A wallet that can do one but not the other declares `transfer: false`. Partial
support is worse than none here: the whole point of the method is that its result
can be trusted as evidence and that a human saw what they authorised.

## Supported

### Console — implemented

`packages/adapters/console/src/console-adapter.ts`

`submitCommands` is itself a typed transfer (`from`/`to`/`token`/`amount`/
`expireDate`/`memo`), so the wallet builds the command and prompts. The update id
comes from the `txChanged` stream, correlated to the call through the signature.

Two limits, both surfaced as errors rather than silently absorbed:

- `expireDate` is required by the wallet, so an intent with no `executeBefore` is
  refused rather than given an invented deadline the user would then be shown.
- `memo` is a single string, so a `meta` map with anything other than one `memo`
  key is refused.

Open against a live wallet: `SignSendRequest` has `token: string` and no admin
field, so the issuing admin does not reach the wallet on this path. Whether
Console's confirmation names the issuer, and how it disambiguates two instruments
sharing an id from different admins, is a question only a live wallet answers.

### Nightly — implemented

`packages/adapters/nightly/src/nightly-adapter.ts`

The closest fit of the three. `createTransferCommand` takes the intent almost
verbatim and is the only one of the three that carries the instrument **admin**
through, so the wallet's confirmation can name the issuer.
`submitTransactionCommand` reports an explicit approve or reject and returns the
real `updateId` directly on approval.

`memo` is a single string; a wider `meta` map is refused.

### Loop — implemented

`packages/adapters/loop/src/loop-adapter.ts`

The SDK's own `transfer(recipient, amount, instrument, options)`, run in
`executionMode: 'wait'` — the mode in which `RunTransactionResponse` carries
`update_id` at all. `TransferOptions` carries both `memo` and `executeBefore`, so
the deadline maps directly with nothing invented.

Note the pre-existing `submitTransaction` path on this adapter reports
`submission_id ?? command_id` as its `updateId`
(`packages/adapters/loop/src/loop-adapter.ts:490`). Neither is an update id; the
real field was sitting unread in the SDK's own response type. `requestTransfer`
reads it.

## Not supported: cannot be met

### Bron — no execute path at all

**Decided by:** `packages/adapters/bron/src/bron-adapter.ts:86` — `getCapabilities()`
returns `connect`, `disconnect`, `restore`, `remoteSigner`, `signMessage`,
`signTransaction`, `ledgerApi`. There is no `submitTransaction`, and no
`submitTransaction` or execute method anywhere in the package.

Bron is an enterprise remote signer. It signs; it does not submit. Its entire API
client is two operations — `requestSignature` and `pollRequestStatus`
(`packages/adapters/bron/src/api.ts`) — and neither response type carries an
update id (`BronSignResponse`, api.ts:44; `BronRequestStatus`, api.ts:55). The
string `updateId` does not appear in the package.

It satisfies the approval half: a human approves or denies in Bron's console
(`status: 'approved' | 'denied'`). It cannot satisfy the update-id half, because
nothing executes.

**Route:** Bron adds a submit/execute endpoint that takes the signed transaction
and returns the ledger update id. That is a change to Bron's service and its API,
not to PartyLayer. Once it exists, this adapter implements `requestTransfer` as
`requestSignature` → execute.

### Cantor8 — no ledger update id, and a lossy amount

**Decided by:** `@cantor8/wallet-connect-sdk@0.4.0`, `dist/types.d.ts:153` —
`SubmitTransferResultPayload` is `{ txId: string }` and nothing else.

Two independent disqualifications:

1. **No update id.** The SDK's whole surface exposes only `txId`
   (`SubmitTransferResultPayload` at types.d.ts:153, `TransferTransactionPayload.txId`
   at :145, the `txChanged` event at :23). `txId` is Cantor8's own handle, which
   its own `checkTxStatusById` consumes. No field maps to a Canton `updateId` or
   `completionOffset`. `updateId` does not appear anywhere in the adapter package
   either.
2. **Amount is a JS number.** `send()` takes `amount: number`
   (`dist/provider.d.ts:21`). Converting a decimal-string amount to a JS number is
   the lossy coercion `toTransferIntent` exists to refuse; it can silently change
   the amount the user is shown and approves.

Worth recording, because it is otherwise the best-shaped of them all: Cantor8's
`send()` takes `senderPartyId`, `instrumentId`, `receiverPartyId`, `memo` **and a
full `metadata` map** — the only wallet here that could carry `meta` without
narrowing it to a single memo.

**Route:** Cantor8 changes `send()` to accept a decimal string, and returns the
ledger `updateId` (from `send` or from `checkTxStatusById`). Both are changes to
Cantor8's SDK. With those two, this becomes the cleanest implementation of the
set.

## Not supported: blocked on the standard, not on the wallet

The next four share one cause, so they share one section.

**The cause.** CIP-0103 has no intent-level transfer method. Its only write verb,
`prepareExecute`, takes a prepared **command body**, not an intent. Two
independent implementations agree:

- Console types it as `ExecuteRequest = Omit<PrepareTransactionBodyDTO, 'partyId'>`,
  whose `commands` is `object[]`
  (`@console-wallet/dapp-sdk@2.2.8`, `dist/esm/types/execute.type.d.ts`).
- Send types it as `SendPrepareSubmissionRequest`, with a required `commands`
  array (`packages/adapters/send/src/send-adapter.ts:286`).

PartyLayer could bridge that gap only by building the Daml command itself — which
would make it a ledger client, fetching a transfer factory and a choice context.
It is not one, and the boundary is deliberate:
[PartyLayer and Canton topology](./partylayer-and-canton-topology.md). Doing it
would also be the same class of mistake as opening `ledgerApi`: moving work into
the layer that must not understand it.

So these four report `transfer` absent, which is the truthful state.

### Send

**Decided by:** `packages/adapters/send/src/types.ts:14` — the `SendRpcMethod`
union is the complete set of methods the wallet exposes, and contains no
intent-level verb; the only write methods are `prepareExecute` and
`prepareExecuteAndWait`.

Send is otherwise the best-behaved adapter in the repository on this axis: it
already reads a **real** update id from `prepareExecuteAndWait` and throws,
naming the expected shape, when it is absent
(`packages/adapters/send/src/send-adapter.ts:300-306`). It satisfies both hard
rules. It lacks only the verb.

**Route:** Send adds an intent-level method to its RPC surface, or CIP-0103 gains
one. The adapter change afterwards is small, because the result handling exists.

**Live question, if you want it settled sooner:** does Send's
`window.canton.request` accept any method beyond the eleven modelled at
types.ts:14 — specifically anything transfer-shaped? The union is PartyLayer's
model of Send's protocol, not Send's own manifest. Answering it needs the Send
extension installed and a `status`/introspection call against a real provider.

### WalletConnect

**Decided by:** `packages/adapters/walletconnect/src/walletconnect-adapter.ts:408-419`
— `submitTransaction` issues `prepareExecuteAndWait` with `params.signedTx`
passed through as the command body. The `canton_` namespace mirrors CIP-0103, so
it inherits the standard's gap exactly.

Separately worth fixing (tracked in the placeholder-values issue, not here): line
418 falls back to `result?.tx?.commandId ?? 'pending'` and returns the literal
string `pending` as a `transactionHash`.

**Route:** the same standard-level change as Send. WalletConnect carries whatever
verbs CIP-0103 defines.

**Live question:** which `canton_*` methods does a given remote wallet actually
advertise in its WalletConnect session namespace? That is per-wallet and
negotiated at pairing time; it cannot be read from this repository. Answering it
needs a live pairing with a specific wallet and an inspection of the approved
session's methods.

### Announce (Path A) and Discovery (Path B)

**Decided by:** `packages/sdk/src/announce-adapter.ts:323-334` and
`packages/sdk/src/discovery-adapter.ts:326-335` — both implement
`submitTransaction` as a single `prepareExecute` RPC with the caller's opaque
params. These are the generic paths, so they can offer exactly what the standard
defines and nothing more.

Both already report `transfer` absent with no change needed: the announce
adapter's `getCapabilities()` includes an optional method only when it was
assigned (`announce-adapter.ts:217`), and discovery's is a fixed baseline
(`discovery-adapter.ts:191`). Neither lists it.

**Route:** an intent-level method in CIP-0103. The shape in
[typed transfer](./typed-transfer.md) is a reasonable basis for proposing one — it
is not invented, it is where the CIP-0056 `Transfer` record and three independent
wallet SDKs (Console, Nightly, Loop) already agree. When the standard has the
verb, both generic paths gain the capability declaratively, through the registry
entry's `adapter.config`, with no per-wallet code — the same way `ledgerApi`,
`restore` and `events` are opted into today (`packages/sdk/src/client.ts:110-137`).

## Summary

| Wallet | Verdict | Deciding evidence |
|---|---|---|
| Console | implemented | `submitCommands` + `txChanged` |
| Nightly | implemented | `createTransferCommand` + `submitTransactionCommand` |
| Loop | implemented | SDK `transfer()` in `wait` mode |
| Bron | cannot be met | no execute path — `bron-adapter.ts:86` |
| Cantor8 | cannot be met | no update id — `types.d.ts:153`; `amount: number` — `provider.d.ts:21` |
| Send | blocked on the standard | `types.ts:14`, no intent verb |
| WalletConnect | blocked on the standard | `walletconnect-adapter.ts:408` |
| Announce (Path A) | blocked on the standard | `announce-adapter.ts:323` |
| Discovery (Path B) | blocked on the standard | `discovery-adapter.ts:326` |

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

Record, for each of Console, Nightly and Loop: what the confirmation actually
displayed (a screenshot is the useful artefact), the `updateId` returned, whether
it resolves on the ledger, and what a declined approval produced.

Then repeat with `amount: '0.01'` replaced by a deliberately malformed intent —
`amount: 0.01` as a number — and confirm it is refused before the wallet is ever
opened.

### Known open questions a live run would settle

- **Console: does the confirmation name the issuing admin?** `SignSendRequest`
  has `token: string` and no admin field, so the admin does not reach the wallet
  on this path. If Console resolves the token against its own registry the
  display is fine; if two instruments can share an id across admins, this needs a
  different mapping.
- **Console: does the signature correlation hold?** The adapter matches the
  `signed` event's `payload.signature` against the value `submitCommands`
  returns. If the live wallet does not populate both identically, the adapter
  falls back to a single in-flight command and otherwise refuses. A run with two
  concurrent transfers would exercise the refusal.
- **Loop: does `transfer()` in `wait` mode always populate `update_id` on
  success?** The SDK types it optional (`update_id?`). The adapter throws when it
  is absent, so the failure is safe — but if it is routinely absent, the mapping
  needs revisiting.
