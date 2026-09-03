# @partylayer/adapter-console

## 0.4.0

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

## 0.3.19

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.3.18

### Patch Changes

- 17466dc: Bump `@console-wallet/dapp-sdk` to `^2.2.8` (from `^2.1.5`), resolving a stale lockfile pin. The 2.1.5 to 2.2.8 range is additive features and fixes with no breaking changes to the SDK surface the adapter calls (`status`, `submitCommands`, `signMessage`, connection-status), verified against the SDK's bundled changelog.

## 0.3.17

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.3.16

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.3.15

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.3.14

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

## 0.3.13

### Patch Changes

- fix(adapter-console): signMessage uses base64 ({ message: { base64 } } per Console extension + dapp-sdk 2.1.5) and connect network resolution falls back to ctx.network for unrecognized wallet networks (isRecognizedNetwork).

## 0.3.12

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

## 0.3.11

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.3.10

### Patch Changes

- 46ccf16: Fix an SSR crash: lazy-load the Console Wallet SDK so importing `@partylayer/adapter-console` on the server no longer eagerly initializes the SDK's localforage storage (which throws "No available storage method found" with no IndexedDB/localStorage).

  The static value import of `@console-wallet/dapp-sdk` is replaced by a promise-cached dynamic import (`getConsoleWallet()`) that loads the SDK once, lazily, on first browser use. **Behavior-preserving, no public API change:** `on()` keeps its synchronous `(): () => void` signature (the subscription registers one microtask later via the cached import; events arrive via async postMessage, so none are missed). Fixes the localforage error logged by any SSR consumer (Next.js App Router, the demo).

## 0.3.9

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.3.8

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.3.7

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.3.6

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.3.5

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.3.4

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
