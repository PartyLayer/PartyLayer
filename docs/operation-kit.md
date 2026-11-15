# Canton operation kit

Status: React 3.4.0 is published with the optional `/operations` entry point.
Public files, registry signatures and exact-workflow provenance are verified in
the [release evidence](releases/canton-operation-kit-2026-11-14.md).
The fixture preview remains development-only.

## Installation and architecture

The operation components belong to the existing React package. There is no new
wallet package to install and no alternative to the native CIP-0103 provider.
The normal integration remains:

```sh
npm install @partylayer/react @tanstack/react-query
```

Use `PartyLayerKit` and `ConnectButton` for connection. Import the optional
operation components from `@partylayer/react/operations`. They share the same
client, session, locale, theme and transaction history. Their code and fourteen
operation translations stay outside the Connect Wallet import surface.
In React 3.4 or later, when no locale is configured, the UI uses a supported browser language after
hydration and falls back to English. An application's explicit language setting
or a manual language choice takes priority.

## Review, then approve

`TransferForm` takes `networkId`, `instrumentId` and an application-owned
`prepare` callback. `tokenName` is an optional display label; the actual instrument
issuer and id remain visible. Amounts are decimal strings, never JavaScript
numbers. The form accepts positive Daml decimals with up to ten fractional digits.

Preparation is read-only: resolve the registry factory, current choice context,
input holdings and disclosed contracts. Return the wallet submission parameters
and a short expiry. Do not sign or submit from this callback.

```ts
import type {
  OperationPreparationContext,
  PreparedOperation,
} from '@partylayer/react/operations';
import type { TransferIntent } from '@partylayer/core';

type PrepareTransfer = (
  intent: TransferIntent,
  context: OperationPreparationContext,
) => Promise<PreparedOperation>;
```

The application implementation is registry-specific. The contract is:

1. Bind the requested asset, exact amount and recipient to the application's
   authenticated intent. A backend derives the authorized party/network from its
   own session; it never trusts browser-supplied `actAs` or a participant URL.
2. Include `context.commandId` in `parameters.signedTx.commandId`. PartyLayer
   generates this id before preparation. A different id is rejected.
3. Return `expiresAt` as epoch milliseconds, in the future and no more than five
   minutes away. Use a shorter expiry when registry context or a quote requires it.
4. Use a stable callback, such as `useCallback`, so changing the configured route
   invalidates an earlier review. Preparation receives an AbortSignal and has a
   bounded timeout.

Inputs and command payloads use plain JSON data. Use ISO timestamp strings,
finite JSON numbers where the ledger schema permits numbers, and decimal strings
for token amounts. Dates, custom classes, functions, cycles and missing array
elements are rejected rather than silently transformed. Public review results
contain only the immutable reviewed input and expiry; internal prepared commands,
client references and route bindings are not exposed.

The user reviews the recipient, amount and issuer, then explicitly approves in
the wallet. Session, wallet, network, route, command id and expiry checks run
before the single wallet write. A review is consumed before submission. Duplicate
clicks cannot resend it. Preparation cancellation never claims to cancel a write
already sent to a wallet.

The form offers this command route only for a connected session reporting
`submitTransaction` on the required network and an explicitly configured preparer.
It does not infer support from a wallet brand or use message signing as a transfer
fallback. Wallet-owned intent transfer remains a separate optional SDK capability.

## Transfer acceptance and withdrawal

`TransferInbox` receives an authenticated `TransferInboxSnapshot`: wallet, party,
network and versioned V1/V2 instruction references. Data from a different identity
or network is masked. Loading and read errors do not display stale offers.

Supply `prepareAction` to resolve the registry's current action context and
disclosures, then return the bound submission payload. Acceptance, rejection and
withdrawal each require a review and a separate wallet approval.

- V1: the recipient can accept/reject a pending receiver offer; the sender can
  withdraw. Internal workflow is not presented as a recipient acceptance action.
- V2: eligibility comes from the interface's `availableActions` groups. Every
  party in one advertised group must authorize. The ready UI uses the connected
  party only; it never assumes custody or a delegation because a provider appears
  in an account record. Registry-specific joint authorization belongs in an
  application flow with independently established authority.
- Expired acceptance is blocked. Reject/withdraw availability is checked against
  the standard view and the registry must still authorize execution.

When an instruction changes, its review is discarded. Registry reads should
refresh after a submitted action. A confirmed action is not automatically treated
as a completed transfer: V2 acceptance may produce another pending instruction.

## Ledger inclusion and business outcome

`OperationStatus` displays the transaction lifecycle from `useTransactionFlow`.
`submitted` means an acknowledgement; `confirmed` requires a separate ledger read
correlating the original application command and the returned update id.

An application may additionally supply `OperationOutcome`, obtained from its
authoritative registry/backend. Completion is displayed only when wallet, party,
network, command id and update id match the confirmed transaction and a source id
is present. An unbound success callback is insufficient. The application must
validate actual transfer events, instruction state or protocol settlement; these
field checks do not authenticate a malicious outcome source.

Without matching business evidence, the UI says that the transfer outcome has not
yet been verified. It distinguishes pending receiver acceptance, remaining
workflow, completion and failure. A swap protocol's deposit, swap execution,
return/refund and recovery stages also require protocol evidence; a successful
message signature or deposit alone does not prove the swap completed.

After an unknown/submitted write, the form offers read-only reconciliation when
configured. It does not automatically resend or enable a replacement write.
Keep an authoritative intent record to handle unknown outcomes across reloads;
the optional browser journal is not a trusted financial database.

## V2 holdings and an application's participant

V1 APIs retain their existing return types. Configure `holdingV2InterfaceId` and
call `reader.readHoldingsV2()` or `useWalletTokenHoldingsV2()` explicitly for V2.
Use exact deployed, package-id-qualified interface ids; no package id is guessed
and V2 never falls back to V1.

V2 retains the full `account`: optional owner/provider plus the account id. An
empty account id means the default account. Ownerless administrative accounts are
valid standard records, but neither they nor provider-only visibility count as
the connected user's owned portfolio. Balance summaries separate issuer, asset,
account number and provider. Reported locks remain locked until ledger data
changes them; the browser clock alone does not make assets spendable.

The same reader can use wallet `ledgerApi` or the explicit same-origin application
transport. See [the ledger reader contract](wallet-ledger-reader.md) and the
[authenticated server example](../examples/authentication-server/README.md).
Participant credentials stay server-side. Application reads do not claim a wallet
capability, grant `actAs`, vet DARs, host a party or establish a delegated signer.
Submission through an application's own participant needs the participant's real
authorization and the wallet/provider's supported signing/submission contract;
the read preset alone does not establish that write route.

## Verification and preview

Run the normal package tests, builds, API and packaging checks. The optional
entry point must not increase the connection surface beyond its existing budget.
The browser compatibility matrix includes the operation preview in Chromium,
Firefox and WebKit plus emulated Android/iPhone profiles, Arabic RTL and both
themes. These are controlled UI tests, not physical-device or vendor certification.

During development open `/operation-preview`. It is explicitly labeled as a
fixture preview and returns 404 in production. It never contacts a real wallet or
participant. Funded wallet/transfer/swap acceptance remains separately recorded
in [wallet acceptance](wallet-acceptance.md), as requested by the maintainer.

## Standard references

- [HoldingV2](https://docs.dev.sync.global/app_dev/api/splice-api-token-holding-v2/Splice-Api-Token-HoldingV2.html)
- [TransferInstructionV2](https://docs.dev.sync.global/app_dev/api/splice-api-token-transfer-instruction-v2/Splice-Api-Token-TransferInstructionV2.html)
- [Canton dApp SDK](https://docs.canton.network/sdks-tools/sdks/dapp-sdk/overview)
