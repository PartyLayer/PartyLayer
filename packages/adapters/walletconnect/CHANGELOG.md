# @partylayer/adapter-walletconnect

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

### Patch Changes

- Updated dependencies [9e8ca31]
- Updated dependencies [fbda51f]
  - @partylayer/core@0.14.0

## 0.3.10

### Patch Changes

- Updated dependencies [4309023]
  - @partylayer/core@0.13.0

## 0.3.9

### Patch Changes

- Mark the package as free of import-time side effects (`"sideEffects": false`) so bundlers can tree-shake unused exports. The flag was in the repository but had never been published, so no installed version carried it and the measured tree-shaking never reached consumers; this is the change that delivers it. Verified per package that nothing runs at import beyond pure construction: no side-effect or asset imports, no writes to `window`, `globalThis`, or `global`, no prototype patching, and no import-time storage, DOM, or network access.
- Updated dependencies
  - @partylayer/core@0.12.1

## 0.3.8

### Patch Changes

- Updated dependencies [d7317a5]
- Updated dependencies [482ec3e]
- Updated dependencies [d132cf3]
  - @partylayer/core@0.12.0

## 0.3.7

### Patch Changes

- Updated dependencies
  - @partylayer/core@0.11.0

## 0.3.6

### Patch Changes

- Updated dependencies [4850140]
  - @partylayer/core@0.10.0

## 0.3.5

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

## 0.3.4

### Patch Changes

- Updated dependencies [5546a90]
  - @partylayer/core@0.9.0

## 0.3.3

### Patch Changes

- Updated dependencies [bef0ac6]
  - @partylayer/core@0.8.0

## 0.3.2

### Patch Changes

- Updated dependencies [3285ed8]
  - @partylayer/core@0.7.0

## 0.3.1

### Patch Changes

- Updated dependencies [6efe375]
- Updated dependencies [adaff8e]
  - @partylayer/core@0.6.0

## 0.3.0

### Minor Changes

- 9642aee: feat(adapter-walletconnect): derive the WalletConnect CAIP-2 chain from the configured network (ctx.network); explicit chainId still overrides

  The official dapp-sdk adapter's `chainId` is now derived from the
  PartyLayer-configured network (`ctx.network` → `toCAIP2Network`, e.g. 'mainnet'
  → 'canton:da-mainnet') instead of being left unset (which let dapp-sdk default
  to devnet). Precedence: explicit `config.chainId` > derived-from-network >
  unset. The memoized official adapter rebuilds when the resolved chain changes
  (live network switch); same-chain reuse is preserved, and callers without a
  network (signMessage/ledgerApi) never tear down an active session. An invalid
  custom network leaves the chain unset (defensive). Backward-compatible: pass an
  explicit `chainId` to pin a chain regardless of the configured network.

- 32c6c1c: feat: report the wallet's effective network in session.network (enables network-mismatch detection)

  `connect()` now sets `session.network` to `status.network?.networkId ??
account.networkId ?? ctx.network`. A1 already constrains the requested WC chain;
  this makes the session truthful so the SDK can also catch a post-connect network
  divergence. Unchanged when the wallet is on the configured network.

### Patch Changes

- Updated dependencies [9642aee]
- Updated dependencies [2c4c10c]
  - @partylayer/core@0.5.0

## 0.2.0

### Minor Changes

- e43863b: Add `@partylayer/adapter-walletconnect`: an opt-in PartyLayer `WalletAdapter`
  that wraps the official `@canton-network/dapp-sdk` `WalletConnectAdapter`, so
  dApps can connect Canton wallets over WalletConnect (hosted/mobile wallets, e.g.
  Nightly mobile).
  - Wraps (does not reimplement) the official adapter: SIWX, the `canton_` method
    mapping, `session_event` handling, and restore all come from dapp-sdk.
  - Config: `projectId` (required), `metadata`, `onUri` (wire to the connect
    modal's QR UI), optional `signInWithCanton`/`onSignInWithCanton`. `chainId` is
    left unset by default (request the `canton` namespace per the Canton WC spec).
  - **Opt-in:** NOT in `getBuiltinAdapters()`. Apps enable it by registering it via
    `config.adapters` and installing the optional `@walletconnect/sign-client` +
    `@walletconnect/types` peers.
  - **Lazy:** the dapp-sdk barrel (which statically imports `@walletconnect/sign-client`)
    is loaded only via dynamic `import()` inside `connect()`/`restore()`; importing
    this package's entry pulls neither dapp-sdk nor sign-client, so non-WC
    consumers' webpack/Next builds are unaffected.

  Runtime deps: `@partylayer/core` + `@canton-network/dapp-sdk`. `@walletconnect/*`
  are optional peers.

  Pending (separate step): live WC E2E against a real Canton WC wallet + real
  `projectId`.

### Patch Changes

- 53b1714: WalletConnect / QR-only wallets now show a scannable QR **in the connect modal**
  out of the box (no integrator wiring), with a mobile deep-link, and the official
  dapp-sdk blank `about:blank` popup is suppressed.
  - **core / sdk:** add an optional `onDisplayUri(uri)` callback to the adapter
    `connect()` options and to `ConnectOptions`. Adapters call it with a
    pairing/display URI (e.g. a WalletConnect `wc:` URI) the moment one is
    produced, before approval; the connect UI uses it to render a QR / deep-link.
    Backward-compatible (optional).
  - **adapter-walletconnect:** the official adapter's `onUri` is now always
    wrapped so the pairing URI is fanned out to BOTH the integrator's
    `config.onUri` AND the per-connect `onDisplayUri`. No hand-wiring needed. The
    adapter also narrowly intercepts the official adapter's blank
    `window.open('', 'wallet-popup')` during connect (no config flag exists to
    disable it) and restores `window.open` afterward.
  - **react:** the modal renders the WC QR itself. `handleWalletClick` passes
    `onDisplayUri` for non-dual (QR-only / remote-signer) wallets and enters the
    QR view only once a URI actually arrives (wallets that draw their own QR are
    unaffected). QR generated via `qrcode` (new dependency). Copy is
    wallet-agnostic for the generic WalletConnect entry ("Scan with your Canton
    wallet" / "Open wallet"). The dual-transport (Console) extension + placeholder
    QR-fallback flow is unchanged.

- dd6932c: Fix: implement the `signMessage` and `ledgerApi` methods that the adapter
  already declared in `getCapabilities()` but never implemented.

  Previously the adapter listed `signMessage` and `ledgerApi` as capabilities
  while providing no corresponding methods, so `client.signMessage(...)` /
  `client.ledgerApi(...)` threw `CapabilityNotSupportedError` in
  `@partylayer/sdk`. The request never reached the wallet. Both now delegate to
  the official `@canton-network/dapp-sdk` adapter (mirroring `submitTransaction`):
  - `signMessage` → `canton_signMessage` (`SignMessageParams { message }` →
    `SignedMessage { signature, partyId, message, … }`).
  - `ledgerApi` → `canton_ledgerApi` (proxies a JSON Ledger API request; response
    normalized to `{ response: string }`).

  `signTransaction` intentionally still throws (Canton WalletConnect fuses
  sign-and-submit. Use `submitTransaction` → `canton_prepareSignExecute`).
  A capability/method integrity test now asserts every method-capability has a
  working method, to catch this class of mismatch.

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0
