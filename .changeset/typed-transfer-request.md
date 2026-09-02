---
"@partylayer/core": minor
"@partylayer/sdk": minor
"@partylayer/adapter-console": minor
"@partylayer/adapter-nightly": minor
"@partylayer/adapter-loop": minor
---

Add `requestTransfer`, a typed transfer method where the wallet performs the interactive submission.

An application passes an intent — receiver, amount, instrument and its issuing admin, optional metadata and deadline. The wallet builds the command from it, prepares it against its own validator, decodes and displays it, obtains the user's approval, signs, executes, and returns the real ledger update id. The application never holds the prepared transaction and never sees the hash before the user does.

This exists so that a transfer does not have to be routed through `ledgerApi`. A generic proxy pointed at the interactive-submission endpoints is a request to sign arbitrary bytes: the wallet cannot decode what was asked for, so it cannot render a meaningful confirmation, so the user approves a hash. `ledgerApi` is unchanged, and this method sits alongside it.

New in `@partylayer/core`:

- `TransferIntent`, `TransferResult`, `TokenInstrumentId`
- `toTransferIntent()` and `TRANSFER_INTENT_FIELDS` — the field allowlist every adapter builds its wallet request through, so a caller-supplied option cannot reach a wallet
- `WalletAdapter.requestTransfer?()` — optional; a wallet that cannot both return a real update id and show an explicit user approval does not implement it
- `CapabilityKey` gains `'transfer'`; `ErrorMappingContext.phase` gains `'requestTransfer'`

New in `@partylayer/sdk`:

- `PartyLayerClient.requestTransfer()`, which narrows the intent through the allowlist before any adapter sees it and throws `CapabilityNotSupportedError` when the active wallet does not implement it

Additive throughout: no existing method signature, adapter contract, or published interface changes. Ask before calling with `session.capabilitiesSnapshot.includes('transfer')`, or require it at connect with `connect({ requiredCapabilities: ['transfer'] })`.

`TransferResult.updateId` is required and always real. An adapter that cannot obtain one throws rather than substituting a command id, a submission id, a signature, or a generated string.

Implemented natively by three adapters, each mapping the intent onto its wallet's own typed transfer:

- **Console** — `submitCommands`, with the update id read from the `txChanged` stream and correlated to the call by signature. Requires `executeBefore`, and carries `meta` only as a single `memo`; both are refused rather than silently dropped.
- **Nightly** — `createTransferCommand` + `submitTransactionCommand`. The only one of the three that carries the instrument's issuing admin through to the wallet.
- **Loop** — the SDK's `transfer()` in `wait` mode, which is where `RunTransactionResponse.update_id` is populated.

Each declares the `transfer` capability. Every other adapter reports it absent, so a dApp can ask before offering the action. The per-adapter integration status is in docs/typed-transfer-support.md.
