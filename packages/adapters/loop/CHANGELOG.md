# @partylayer/adapter-loop

## 0.6.1

### Patch Changes

- c130fc4: Correct SDK README examples to include the required application configuration. Show Send's Mainnet kit integration and explicit compatibility setup without duplicate registration, and document Bron's application-owned OAuth/API requirements. These complete examples now compile against the public package declarations in the documentation gate.

## 0.6.0

### Minor Changes

- 0ebd598: Stop reporting wallets as installed when nothing was installed.

  `detectInstalled()` could only answer yes or no, and eight of twelve adapters had
  no honest way to answer it — a QR wallet, a hosted popup, a relay and an OAuth
  service have no local artefact to probe. They answered `true`, meaning
  "reachable", and the picker read it as "installed". Cantor8 is not an extension
  at all: its tile said installed, and clicking it opened a tab.

  `AdapterDetectResult` gains `availability`, which says what presence actually is:
  `installed`, `not-installed` (probed and absent, with an install URL),
  `no-local-install` (QR / popup / relay — nothing to probe), or `unknown` (the
  probe failed or timed out, which is not proof of absence). `installed` is
  deprecated in its JSDoc, still populated, and exactly
  `availability.kind === 'installed'`, so no consumer breaks.

  **The false `true` was load-bearing.** `installGuard` read `installed` and threw
  `WalletNotInstalledError` on false — so returning the truth would have blocked
  connect for every wallet that has nothing to install. Making the adapters honest
  broke connect for all of them until the guard was changed to ask its real
  question: not "is it installed" but "do we already know this cannot work", which
  only `not-installed` answers yes to. That coupling is why this is one contract
  change rather than eight independent bug fixes.

  Vendor `detect()` is no longer called for `discovery-adapter` wallets. All three
  implementations are constants (`walley`: `window.open` exists; `cauri`:
  `Promise.resolve(true)`; `oneswap`: `typeof window !== 'undefined'`), so awaiting
  them bought no information while adding an async hop to the picker's render path
  and a dependency on three third parties answering honestly. A `discovery-adapter`
  transport IS the answer; the rule is applied in exactly one place.

  The picker's subtitles for the two wallets measured causing real harm now say
  what a click will do: "Scan to connect — nothing to install" and "Opens in a
  popup — nothing to install".

  `docs/adapters.md` records which adapters probe what, and one mismatch still
  outstanding: Cantor8 classifies as `scan` but opens a tab, a registry-data fix
  queued with the D5/D6 registry work.

- 55ff8d1: Raise Loop's transaction outcome as an event instead of discarding it, and make
  the `events` capability true.

  Minor rather than patch: this adds public API — `LoopAdapter.on()` and the
  `LoopAdapterEvent` type. Additive and non-breaking, but a new surface consumers
  can depend on is not a patch, even when the reason for adding it is a fix.

  `onTransactionUpdate` went to `ctx.logger.debug` and nowhere else. Per the
  vendor's own README (identical in 0.13.2 and 0.13.4):

  > `submitTransaction` is the default async path. It returns the submission
  > result first (including `command_id` and `submission_id`), then the ledger
  > update arrives later via `onTransactionUpdate` with `update_id` and
  > `update_data`. On success it also includes `update_data` (ledger transaction
  > tree); on failure it includes `status: "failed"` and `error.error_message`.

  Our `submitTransaction()` uses that async path, so its receipt is a submission
  acknowledgement, not an outcome. Discarding the hook meant a consumer submitting
  through Loop could never learn whether the transaction committed, or why it
  failed. The payload is now mapped onto core's transaction vocabulary
  (`committed` / `failed` / `submitted`, with `update_id` as the transaction id and
  `update_data` passed through untouched) and dispatched to subscribers.

  `getCapabilities()` declared `events` while the adapter contained no dispatch of
  any kind and the Loop provider exposes no subscription surface — no `on`, no
  `addListener`, in 0.13.2 or 0.13.4. By this repo's own rule (`announce-adapter.ts`
  pushes `events` only when a provider `on` exists) that claim was false. Rather
  than drop the capability, the adapter now provides the surface that makes it
  true: `on('txStatus', handler)`, matching the Console adapter's signature so a
  consumer writes the same code against either wallet.

  Scoped honestly to ONE event. Loop's SDK defines four `ProviderHooks`, but only
  `onTransactionUpdate` is reachable by a dApp: `loop.init()` accepts `onAccept`,
  `onReject` and `onTransactionUpdate` and nothing else, while the full
  `ProviderHooks` is a `Provider` constructor parameter held in a `private hooks`
  field with no setter — and the SDK builds the Provider itself before handing it
  to `onAccept`. `sessionExpired` and a generic `error` channel are therefore not
  declared: we could never raise them.

### Patch Changes

- b4961d2: Require `@fivenorth/loop-sdk` ^0.15.1, so signing opens the wallet on the domain
  the user connected through.

  Loop moved its wallet from `*.cantonloop.com` to `wallet.*.looptech.io`
  (`@fivenorth/loop-sdk` 0.15.0, fivenorth-io/loop-sdk#88), keeping the old domain
  as `secondaryWalletUrl`. The API host and the pairing socket stay on
  `*.cantonloop.com`. From 0.15.0 the SDK records which domain approved the
  connection (`isFromOldDomain` in the handshake) and opens the signing window
  there (`resolveWalletUrl`). 0.13.x has no notion of two domains: it always opens
  `walletUrl`, which it still sets to the old domain.

  `^0.13.0` cannot resolve to 0.15. On a devnet transfer through 0.13.4, a user
  whose wallet runs on `wallet.devnet.looptech.io` approved "Payvol wants to send
  … CBTC" and got "Action failed: Prepared transaction not found". The adapter
  passes no `walletUrl`, so taking the SDK's defaults is the whole change.

  The SDK's public API change from 0.13.4 to 0.15.1 is additive for what this
  adapter uses:
  - `init` gains an optional `secondaryWalletUrl`;
  - the session gains `walletUrl`;
  - `ExecuteSubmissionResquest` is kept as an alias of `ExecuteSubmissionRequest`;
  - the dist `provider.js` is byte-identical.

  Typecheck and the adapter's 65 tests pass unchanged.

- Updated dependencies [817d357]
- Updated dependencies [2e07185]
- Updated dependencies [882752f]
- Updated dependencies [0ebd598]
- Updated dependencies [8cb0f09]
- Updated dependencies [8e08da9]
  - @partylayer/core@0.15.0

## 0.5.0

### Minor Changes

- a0292e5: **These calls now throw where they previously returned a value:**
  - **`ConsoleAdapter.connect`** — when the wallet reports no party id.
  - **`ConsoleAdapter.signTransaction`** — when the wallet returns no signature. Note this call _never_ failed before: it generated a hash on every invocation regardless of what the wallet said.
  - **`ConsoleAdapter.submitTransaction`** — when the wallet returns no signature.
  - **`NightlyAdapter.submitTransaction`** — when the wallet approves but reports neither an update id nor a signature.
  - **`WalletConnectAdapter.submitTransaction`** — when `prepareExecuteAndWait` returns no update id.

  This is a runtime behaviour change, not an addition, and it is the first thing to plan for. A call site that has never handled an error from these will now need to. The version is a minor because these packages are pre-1.0, not because the change is additive.

  In every one of those cases the value returned instead was manufactured by our adapter — it never came from the wallet — so code relying on it was relying on something that was never true. Nothing that returned a real value changes.

  Stop returning invented values when the wallet reports none. Adapters now fail instead.

  Seven sites across four adapters manufactured data to fill required fields:

  |                                          | Was                                                                 | Now                                                                   |
  | ---------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
  | `ConsoleAdapter.connect`                 | `party-<now>` when the wallet returned no party id                  | throws                                                                |
  | `ConsoleAdapter.signTransaction`         | `tx_<now>_<random>` **on every call**, whatever the wallet returned | the wallet's signature, or throws                                     |
  | `ConsoleAdapter.submitTransaction`       | `tx_<now>` when no signature came back                              | the wallet's signature, or throws                                     |
  | `NightlyAdapter.submitTransaction`       | `tx_<now>_<random>` when neither updateId nor signature came back   | throws; `updateId` now reported when real                             |
  | `LoopAdapter.submitTransaction`          | `updateId: submission_id ?? command_id`                             | reads the SDK's real `update_id`, and **omits** the field when absent |
  | `WalletConnectAdapter.submitTransaction` | the literal string `'pending'` as a `transactionHash`               | throws, matching the Send adapter                                     |

  Two were not fallbacks at all: `ConsoleAdapter.signTransaction` generated a hash on every successful call, and `LoopAdapter` reported a submission id as an update id unconditionally. Both were wrong on the happy path. Every one of these is our own adapter code, not the wallet's.

  **The `ConsoleAdapter` party id is the one to look at first.** A session carrying a fabricated party is not degraded, it is broken — every later call acts as a party that does not exist, and the failure surfaces far from its cause. It now fails at connect.

  **The Loop adapter now reports a real update id.** `RunTransactionResponse.update_id` was always in the Loop SDK's response and our adapter never read it, reaching for `submission_id` instead. A submission id identifies the request, not the committed update. Where no update id exists the field is now omitted rather than substituted, so a caller can tell "no update id" from "here is one".

  **What this does not fix.** `TxReceipt.transactionHash` and `SignedTransaction.transactionHash` are required fields, so an adapter with no hash to give has nowhere to put nothing. `ConsoleAdapter` still reports a signature and `LoopAdapter` a command id under that name — real values the wallets issued, but not transaction hashes. Correcting the label means making those fields optional, which is a published-interface change and its own decision. What these adapters no longer do is invent the value.

- 9e8ca31: **Breaking, and one value changes meaning rather than merely appearing.**

  **`transactionHash` is now optional**, so an adapter with no honest value omits it. If you read `receipt.transactionHash` or `signed.transactionHash`, you must handle `undefined`.

  **On Loop, `receipt.updateId` has changed meaning.** It previously held `submission_id ?? command_id` — a submission id identifies the request, not the committed update. It now holds the Loop SDK's real `update_id`, and is **omitted when that is absent**. So a consumer reading `receipt.updateId` on Loop who previously always got a string may now get `undefined`, and the string they got before did not mean what its name said. This is a value quietly changing meaning, not a field appearing, so it will not show up as a type error at the point that matters.

  **Grep your own code for `String(receipt.transactionHash)`.** Now that the field is optional, that renders the literal text `"undefined"` — it compiles, it is not a type error, and it reaches your UI looking like ordinary output. Template interpolation (`` `${receipt.transactionHash}` ``) and string concatenation do the same. Three such sites existed inside this repository and are fixed here; yours are yours to find.

  ## Why this is breaking, by the rules

  `docs/releasing.md` lists "Changing method signatures (parameters, return types)" as a breaking change. `TxReceipt.transactionHash` and `SignedTransaction.transactionHash` go from `TransactionHash` to `TransactionHash | undefined`, so every consumer reading them must now handle absence. It is a breaking change and is described as one here.

  `@partylayer/react` (2 → 3) and `@partylayer/vue` (1 → 2) take major bumps for it. `@partylayer/core`, `@partylayer/sdk` and `@partylayer/provider` are pre-1.0 and take minor bumps: a jump to 1.0.0 would announce a stability commitment this change does not warrant, and 0.x already sets the expectation that a minor can break. Read the change, not the number.

  Also optional, for the same reason and from the same source: `TxStatusUpdate.txId` (core) and `TxStatusEvent.txId` (sdk).

  ## Who is affected

  The compiler enumerated this, not a grep. Every site that had to change:
  - `@partylayer/sdk` — the three `tx:status` emissions in `client.ts` (sign, submit, transfer)
  - `@partylayer/provider` — `BridgeableClient`'s structural type, and the `signed` / `executed` CIP-0103 payloads
  - `@partylayer/react` and `@partylayer/vue` — the `TransactionToast` detail line

  If you read `receipt.transactionHash`, you now need to handle `undefined`. If you want a ledger identifier, prefer `receipt.updateId`: it is the ledger's own id for the committed update, and several wallets report a real one while having no hash at all.

  **Watch for `String(receipt.transactionHash)`.** That pattern compiles fine and renders the literal text `"undefined"` — a new placeholder created by the very change that removed the old ones. Three such sites existed inside this repository and are fixed here; check yours.

  ## The finding this comes from

  **A required field with no honest value is a defect factory.**

  Nine sites across five adapters manufactured a transaction hash: `tx_<now>_<random>`, `tx_<now>`, `'pending'` (three times), `''`, a command id, a signature. Not one of them was a fallback anybody designed. Every one existed because the type demanded a value the code path could not produce, and the adapter had nowhere to put nothing.

  Two of the nine were found only while making this change — in our Bron adapter, which an earlier survey of this exact problem had missed because they were ternaries rather than `??` chains. That is the argument in miniature: fixing the sites one at a time finds the ones you already know how to look for, and leaving the field required guarantees the next adapter writes a tenth.

  ## Also fixed here
  - **`BronAdapter`** omits `transactionHash` instead of reporting the word `'pending'` as one (two sites).
  - **`LoopAdapter`** omits it instead of reporting the command id under it. The command id is still reported as `commandId`, which is true of it. A real value under a wrong name is the same error as a fabricated one for anyone reading the field by its name.

- fbda51f: Add `requestTransfer`, a typed transfer method where the wallet performs the interactive submission.

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

### Patch Changes

- Updated dependencies [9e8ca31]
- Updated dependencies [fbda51f]
  - @partylayer/core@0.14.0

## 0.4.3

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.4.2

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.4.1

### Patch Changes

- d7317a5: Classify insufficient traffic errors with their own code.

  Traffic exhaustion already reached the kit through the wallet mediated path and was
  flattened into a transport error. It now has its own `INSUFFICIENT_TRAFFIC` code with an
  `InsufficientTrafficError` class. The generic error mapper recognizes the strings Canton
  actually produces (`insufficient traffic` and `AboveTrafficLimit`, case insensitively),
  checked before the rejection branch since Canton's real rejection string contains the
  word rejected. On the Provider surface the code maps to the existing, spec sanctioned
  `-32005` (limit exceeded), which was defined but unused, so no proprietary code is
  introduced. The Loop adapter's `PaymentRequiredError` (402) is re-pointed from transport
  to `INSUFFICIENT_TRAFFIC`, keeping every detail field.

  Synchronizer failures stay out of the taxonomy because they are dApp mediated (Model 2):
  they surface inside the dApp's own ledger and registry calls, not the wallet path. That
  boundary is now documented in the error codes reference.

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.4.0

### Minor Changes

- Update to Loop SDK 0.13, which restores wallet pairing after a Loop server change, read the wallet's payout preapproval signal so consumers can tell whether a payout lands directly or may strand as an unaccepted offer, and surface structured wallet errors (timeout, unauthorized, payment required, and user rejection) with stable error codes.

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.3.15

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

## 0.3.14

### Patch Changes

- eeaddad: Fix `ledgerApi` wallet divergence so one call works across all wallets. The SDK
  boundary (`LedgerApiParams`) accepts a friendly superset, `requestMethod` in
  either case (plus `PATCH`) and `body` as a JSON string **or** a plain object, and
  each adapter normalizes to what its wallet requires:
  - **CIP-0103 `window.canton` RPC wallets**, Send, Console, Nightly,
    WalletConnect, and the SDK announce bridge, get a **lower-case** verb + an
    **object** body, per the canonical CIP-0103 OpenRPC `LedgerApiRequest` schema
    (splice-wallet-kernel). `CIP0103LedgerApiRequest` is corrected to this shape.
  - **Loop** (Loop SDK adapter) and **Bron** (REST proxy) get a **JSON-string**
    body.

  New `@partylayer/core` helpers: `normalizeLedgerMethodLower` +
  `ledgerApiBodyToObject` (the CIP-0103 wallets); `normalizeLedgerMethodUpper` +
  `ledgerApiBodyToString` are retained for Loop/Bron.

  The CIP-0103 provider bridge forwards the verb case and the body type (string or
  object) unchanged to the active wallet's adapter. It no longer `String()`-s an
  object body into `"[object Object]"`. Generic docs/examples use the canonical
  `/v2/state/active-contracts` endpoint (Loop aliases the older `/v2/state/acs`).

  No on-wire change for valid Loop/Bron callers or for Send callers already passing
  valid input; lower-case + object is the CIP-0103 contract itself, so it cannot
  break a conformant wallet.

- Updated dependencies [eeaddad]
  - @partylayer/core@0.9.1

## 0.3.13

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.3.12

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.3.11

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.3.10

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.3.9

### Patch Changes

- 2c4c10c: fix(adapter-loop): fail clearly on unsupported networks instead of silently substituting

  `mapNetworkToLoop` previously mapped testnet→devnet and unknown→mainnet,
  silently connecting to the wrong network. It now returns local/devnet/mainnet
  and throws a clear error for anything else (Loop has no testnet), surfaced via
  the adapter's existing connect error path.

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.3.8

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.3.7

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.3.0

## 0.2.5

### Patch Changes

- fix: resolve workspace:\* protocol in published packages and add ledgerApi support
- Updated dependencies
  - @partylayer/core@0.2.6

## 0.2.4

### Patch Changes

- Update repository URLs and metadata for public release. Add README documentation for all packages.
- Updated dependencies
  - @partylayer/core@0.2.4

## 0.2.2

### Patch Changes

- Update GitHub repository URLs to cayvox/CantonConnect
- Updated dependencies
  - @partylayer/core@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.1

## 0.2.0

### Minor Changes

- Initial public release of CantonConnect SDK.

  CantonConnect provides a WalletConnect-like experience for Canton Network dApps, enabling seamless integration with multiple Canton wallets through a unified API.

  Features:
  - Support for Console Wallet, 5N Loop, Cantor8, and Bron wallets
  - React hooks and components for easy integration
  - TypeScript support with full type definitions
  - Secure session management with encrypted storage
  - Event-driven architecture for real-time updates

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.2.0
