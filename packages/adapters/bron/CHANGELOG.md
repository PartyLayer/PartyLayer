# @partylayer/adapter-bron

## 0.5.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [9e8ca31]
- Updated dependencies [fbda51f]
  - @partylayer/core@0.14.0

## 0.4.1

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.4.0

### Minor Changes

- a5da315: BREAKING: `BronAdapterConfig.api` no longer accepts (or requires) a `getAccessToken`.

  The adapter always supplied its own access-token getter, wiring it to its OAuth
  client, and ignored any `getAccessToken` passed in `config.api`. The type
  nonetheless demanded one (`config.api` was typed as the internal `BronApiConfig`,
  which the API client uses), so every caller had to pass a `getAccessToken` the
  adapter discarded. `config.api` is now typed as the new `BronAdapterApiConfig`
  (`{ baseUrl }`). A caller that passed `getAccessToken` gets a compile error and
  should drop it; `baseUrl` is unchanged and there is no runtime behavior change.

## 0.3.0

### Minor Changes

- 17466dc: Remove Bron's URL- and environment-inferred mock behaviour. The API client no longer fabricates a session or a signature when the base URL contains `dev` or `mock`, and the adapter no longer swaps in a fake client based on `NODE_ENV` or a `useMockApi` flag. Bron now always uses the real API client and, when the OAuth callback is not wired by the app, fails loudly with a clear error instead of pretending in development. A mock, if wanted for a test, must be constructed explicitly by that test; it is never inferred from a URL or the environment. BREAKING: the `useMockApi` field is removed from `BronAdapterConfig`.

## 0.2.21

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.2.20

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.2.19

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.2.18

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

## 0.2.17

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

## 0.2.16

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.2.15

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.2.14

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.2.13

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.2.12

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.2.11

### Patch Changes

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0

## 0.2.10

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
