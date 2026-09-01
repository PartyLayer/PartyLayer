# Typed transfer

`requestTransfer` asks the connected wallet to make a transfer. The application
says what it wants; the wallet does everything else.

```ts
const result = await client.requestTransfer({
  receiver: 'party::bob',
  amount: '10.5',
  instrumentId: { admin: 'party::registry', id: 'CC' },
  meta: { memo: 'invoice-7' },
  executeBefore: '2026-12-31T23:59:59Z',
});

result.updateId; // the real ledger update id
```

One call, one result. In between, the wallet builds the command from the intent
using its own view of what a transfer means, prepares it against the validator it
is connected to, decodes it and shows the user the recipient, the instrument and
its issuer, the amount and any metadata that will be written, takes the user's
approval, signs, executes, and reports the update id.

Your application never holds the prepared transaction, never sees the hash before
the user does, and cannot substitute anything between the display and the
signature.

## Why this is not `ledgerApi`

PartyLayer also exposes `ledgerApi()`, a generic proxy to the JSON Ledger API
with a free-form resource path. You could point it at the interactive-submission
endpoints yourself. Do not.

A generic proxy that can reach prepare and execute is, in effect, a request to
sign arbitrary bytes. The wallet cannot decode what the application asked for, so
it cannot render a meaningful confirmation, so the user approves a hash.

Ethereum removed exactly this capability twice. MetaMask deleted `eth_sign` on
1 August 2024. Safe removed it from its interface on 24 February 2025, three days
after the Bybit incident, in which the approvals recorded were signatures whose
contents the signer could not read. EIP-712 and later ERC-7730 exist because,
without structure, a wallet has nothing to show but a hash.

A wallet's core job is to be the place where a human sees what they are agreeing
to. An interface that makes that impossible is not a shortcut; it removes the
wallet's reason to exist.

`ledgerApi` is unchanged and still there for reads. Transfers go through
`requestTransfer`.

## Ask before you call

Not every wallet implements it. Ask, rather than calling and handling the failure:

```ts
const session = await client.getActiveSession();
if (session?.capabilitiesSnapshot.includes('transfer')) {
  // offer the transfer action
}
```

Or require it up front, and let the picker filter to wallets that have it:

```ts
await client.connect({ requiredCapabilities: ['transfer'] });
```

Calling it on a wallet without the capability throws `CapabilityNotSupportedError`.

## The intent

| Field | | |
|---|---|---|
| `receiver` | required | The receiving party (Daml `Party`). |
| `amount` | required | A decimal **string**. Never a JS `number`. |
| `instrumentId` | required | `{ admin, id }` — the instrument and the party that issues it. |
| `meta` | optional | String-to-string metadata (Daml `Metadata`). |
| `executeBefore` | optional | ISO 8601 deadline (Daml `Time`). |

`amount` is a string because a JS `number` cannot represent a large or precise
`Decimal` losslessly. Passing a number is rejected rather than coerced — silently
changing the amount the user is about to approve would be worse than failing.

`instrumentId` carries the issuing `admin` separately from the `id` so the
wallet's confirmation can name who issues the instrument. Two instruments can
share a symbol; naming one without its issuer does not tell the user enough to
decide.

If you already read holdings with `useTokenHoldings`, its `instrumentId` has the
same shape and can be passed straight through.

### What the intent deliberately does not have

**No `sender`.** The acting party comes from the active session. A
caller-supplied sender is a way to ask the wallet to act as somebody else.

**No `inputHoldingCids`.** The wallet chooses which of its own holdings to spend.
`@partylayer/react`'s `TokenTransfer` type has this field because it belongs to
the Model 2 path, where your dApp owns the write and picks the holdings. Here the
wallet owns the write.

**No approval flag.** There is no option that suppresses the user's confirmation.
Unknown keys are dropped by `toTransferIntent()` before any adapter sees them, so
an extra field cannot be smuggled through to a wallet that might honour it.

## The result

```ts
interface TransferResult {
  updateId: string;          // always real
  commandId?: string;        // when the wallet surfaces one
  completionOffset?: number; // when the wallet reports it
  partyId: PartyId;          // the session's party, which signed
}
```

`updateId` is required and is the ledger's own identifier for the committed
update. An adapter that cannot obtain one throws. It does not substitute a
command id, a submission id, a signature, or a generated string: a field named
`updateId` holding something else will eventually be shown to somebody as
evidence.

So handle the error. A rejected approval, a failed execution and a missing update
id all reject rather than resolving with a placeholder.

```ts
try {
  const { updateId } = await client.requestTransfer(intent);
} catch (err) {
  if (err instanceof UserRejectedError) { /* the user declined */ }
  throw err;
}
```

## Wallet support

| Wallet | `transfer` | Notes |
|---|---|---|
| Console | yes | Maps to `submitCommands`; update id read from the `txChanged` stream. Requires `executeBefore`, and carries `meta` only as a single `memo`. |
| Nightly | yes | Maps to `createTransferCommand` + `submitTransactionCommand`. Carries the instrument admin through. `meta` as a single `memo`. |
| Loop | yes | Maps to the SDK's `transfer()` in `wait` mode. `meta` as a single `memo`. |
| Send, WalletConnect, announce (Path A), discovery (Path B) | no | CIP-0103's only write verb, `prepareExecute`, takes a prepared command body rather than an intent. See below. |
| Bron | no | An enterprise remote signer with no execute path at all. |
| Cantor8 | no | Its SDK exposes no ledger update id, and its `send()` takes `amount` as a JS number. |

Where a wallet cannot carry a field, the adapter **refuses the intent** rather
than dropping it. Metadata the user was shown but that would not be written would
make the confirmation untrue, so a `meta` map that a single-memo wallet cannot
represent is an error, not a silent omission.

### Why the generic paths do not have it yet

CIP-0103 has no intent-level transfer method. Its write verb, `prepareExecute`,
takes a prepared command body — Console types it as
`Omit<PrepareTransactionBodyDTO, 'partyId'>`, Send as a request with a `commands`
array. Two independent implementations, both command-level.

PartyLayer could close that gap only by building the Daml command itself, which
would make it a ledger client. It is not one, and the boundary is deliberate —
see [PartyLayer and Canton topology](./partylayer-and-canton-topology.md).

The route forward is an intent-level method in the standard. The shape in this
document is a reasonable basis for one: it is not invented, it is where the
CIP-0056 `Transfer` record and three independent wallet SDKs already agree.

## For wallet implementors

Implement `requestTransfer` on your adapter only if you can do **both**:

1. return a real ledger update id, and
2. show the user an explicit approval they can decline.

If you can do one but not the other, do not implement it. `getCapabilities()`
then omits `'transfer'`, and applications will not offer the action. A smaller
honest capability set is always better than an aspirational one.

Build your wallet request from `toTransferIntent()`'s output and nothing else.
That is what keeps a caller-supplied option away from your wallet.
