# Typed transfer: integration status

`requestTransfer` is an optional intent-level convenience API: receiver, exact
amount, issuer-scoped instrument, memo and expiry. It is separate from generic
CIP-0103 command submission. The following inventory describes the current
candidate code, not live wallet or ledger acceptance. Review date: 2026-10-24.

## Availability

| Wallet | `requestTransfer` | Current integration boundary |
| --- | --- | --- |
| Nightly | Implemented in the default integration | `createTransferCommand` receives receiver, decimal-string amount, instrument ID **and admin**, memo and expiry. `submitTransactionCommand` reports approval/rejection and the actual update ID. |
| Loop | Implemented in the default integration | Official `transfer` receives receiver, decimal-string amount, `instrument_id` **and `instrument_admin`**, memo and expiry. Wait mode is required; success must include the actual `update_id`. |
| Console | Implemented only in the explicit legacy wrapper | `submitCommands` takes token ID, amount, receiver, memo and required expiry. Its token field does not carry the issuer/admin; the wallet's resolution and approval display still need live acceptance. The default native connection does not expose this optional verb. |
| Send | Unavailable | Native CIP-0103 command submission remains available; the kit does not invent a universal transfer command builder. Mainnet-only in the catalog. |
| Cauri | Unavailable | Official generic provider accepts application-prepared commands, not this kit intent-level verb. |
| Walley | Unavailable | Official generic provider accepts application-prepared commands, not this kit intent-level verb. |
| OneSwap V2 | Unavailable | Generic command execution is separate from OneSwap's protocol/API swap lifecycle. |
| Vala | Unavailable | Devnet beta generic command execution; valid transaction acceptance remains open. |
| WalletConnect | Unavailable | Supported CIP methods are negotiated with the paired wallet; no universal intent-level transfer verb. |
| Cantor8 | Unavailable | The shipped SDK integration cannot establish this API's required exact-amount/ledger-result contract from its transfer API. Generic compatibility submission returns a command acknowledgement; do not treat it as confirmation. |
| Bron | Unavailable | Submission is not implemented by the current enterprise signer integration. |

The generic path can submit valid transfer or swap commands supplied by the
application even when `transfer` is absent. Conversely, `transfer` being present
does not guarantee that arbitrary application contracts or swap protocols work.
Supported operations are the intersection of the integration and active wallet,
network and session.

## Check capability before offering the action

```ts
const session = await client.getActiveSession();
if (!session?.capabilitiesSnapshot.includes('transfer')) {
  // Offer the application's supported command flow or explain the limitation.
  return;
}

const result = await client.requestTransfer({
  receiver: controlledReceiverPartyId,
  amount: '0.01',
  instrumentId: { admin: instrumentAdminPartyId, id: instrumentId },
  meta: { memo: 'Devnet acceptance' },
  executeBefore: new Date(Date.now() + 3_600_000).toISOString(),
});
// Reconcile result.updateId against the intended operation on the ledger.
```

Use `toTransferIntent`/the public client boundary to reject malformed intents
before opening the wallet. Amounts must remain decimal strings. Console's legacy
wrapper requires an explicit expiry; unsupported metadata is refused rather than
silently discarded. Do not infer the issuer from a token symbol alone.

An application that explicitly chooses the existing Console compatibility wrapper
can configure it through the advanced SDK exports. This is an opt-in exception,
not an instruction to install a separate PartyLayer wallet package. It replaces
the native Console path for that application and must be tested accordingly.
See [Console integration](./wallets/console.md).

## Receipt semantics

Nightly uses the actual wallet approval response update ID. Loop's typed transfer
uses the actual `update_id` from wait mode; it must not substitute `submission_id`
or `command_id`. Loop's generic `submitTransaction` also preserves command IDs
separately and includes an update ID only when one is supplied.

Cantor8's compatibility `signAndExecute` resolves without a ledger ID; its
acknowledgement contains the requested command ID and transaction events arrive
separately. Generic providers likewise differ in whether they return a completion
or a plain acknowledgement. See [transaction lifecycle](./transaction-lifecycle.md)
and the [wallet matrix](./wallet-cip0103-matrix.md).

A resolved Promise or a hash-shaped string is not ledger confirmation. Preserve
identifiers exactly, use the validator's documented Ledger API version or an
authorized application read endpoint, and check that the returned operation
matches the original parties, network, issuer/instrument and amount. Never retry
a write automatically to obtain a better receipt.

## Live acceptance still required

For each implemented integration, verify that the approval screen names the
recipient, amount, instrument/issuer, memo and expiry as appropriate; declining
must return rejection without a hang or silent success. Confirm the real ledger
update independently. Console's legacy token-to-issuer resolution is a specific
open acceptance question, not a generic proof that token IDs are globally unique.

A swap additionally requires its protocol's valid quote/commands and final
settlement or refund verification. Message signing alone proves none of those
steps. See [available Devnet environments](./wallet-acceptance.md) and the
[legacy transfer runbook](./DEVNET-RUN.md). Actual observations remain in
[release validation](./releasing.md#default-wallet-release-validation).

## Code and primary references

- [Nightly integration](../packages/adapters/nightly/src/nightly-adapter.ts), [official command API](https://docs.nightly.app/docs/canton/canton/transaction_commands/)
- [Loop integration](../packages/adapters/loop/src/loop-adapter.ts), [official SDK API](https://github.com/fivenorth-io/loop-sdk/blob/main/docs/api-reference.md)
- [Console compatibility integration](../packages/adapters/console/src/console-adapter.ts)
- [Cantor8 compatibility integration](../packages/adapters/cantor8/src/cantor8-adapter.ts)
- [Generic discovery integration](../packages/sdk/src/discovery-adapter.ts)
- [CIP-0103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
