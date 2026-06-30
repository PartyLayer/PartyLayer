# Wallet CIP-0103 Readiness Matrix

**Status:** evidence-based audit of the six in-tree wallet adapters.
**Scope:** this document is descriptive only. No adapter is being removed,
deprecated, or changed in behaviour. It exists so we know exactly which
adapters can eventually be sunset (once the native CIP-0103 path and any
WalletConnect path ship) and what each one would require to get there.

Every claim cites adapter source (`file:line`) or an official wallet doc that
was actually read. Where a claim could not be confirmed from code or public
docs, it is marked **requires live browser check** rather than guessed.

Verdict legend:
- **NATIVE `window.canton`**: speaks the CIP-0103 provider protocol (the
  splice-wallet-kernel OpenRPC surface at `window.canton`).
- **CUSTOM injected**: injects its own object (not `window.canton`) with a
  non-CIP-0103 interface.
- **DEEP-LINK**: mobile deep-link / universal-link transport.
- **WALLETCONNECT / SDK**: QR + WebSocket / proprietary SDK relay.
- **OAUTH / remote**: server-side remote signer over an authenticated HTTP API.
- **STUBBED/UNCONFIRMED**: the in-tree integration is a scaffold; the real
  wallet transport is not confirmed.

---

## Summary table

| walletId | Transport | Detection mechanism (cited) | CIP-0103 verdict | Registry `cip0103.native` | Sunset implication |
|---|---|---|---|---|---|
| console | SDK: extension postMessage (local) / QR-relay (remote) / combined | `consoleWallet.checkExtensionAvailability()` postMessage probe, [console-adapter.ts:657-682](../packages/adapters/console/src/console-adapter.ts#L657-L682) | **NATIVE (CIP-0103 via official SDK)** | `true` (stable + beta) | Likely removable once native path covers extension **and** remote QR-relay; until then keep as SDK shim. Live-check whether Console injects `window.canton`. |
| send | Announce (`canton:announceProvider`) | Announce-gated: `detectInstalled` is true iff Send announces via `canton:announceProvider`, independent of who owns `window.canton`, [send-adapter.ts:104-126](../packages/adapters/send/src/send-adapter.ts#L104-L126), [send-provider.ts:233](../packages/adapters/send/src/send-provider.ts#L233) | **NATIVE (CIP-0103, announce-discovered)** | `true` (stable + beta) | Strongest native candidate. Already announce-based, so Send and Console no longer collide at `window.canton`. |
| loop | QR + WebSocket popup via `@fivenorth/loop-sdk` | None, `detectInstalled` always `true` in a browser (SDK bundled), [loop-adapter.ts:77-89](../packages/adapters/loop/src/loop-adapter.ts#L77-L89) | **WALLETCONNECT / SDK (not CIP-0103)** | absent | Cannot be removed by native+WC alone. Needs Loop to ship a CIP-0103 `window.canton` provider or a standard WC interface. **Keep.** |
| cantor8 | Deep-link (`DeepLinkTransport`) + stub vendor module | Mobile user-agent only: `/iPhone\|iPad\|iPod\|Android/i.test(navigator.userAgent)`, [cantor8-adapter.ts:91-98](../packages/adapters/cantor8/src/cantor8-adapter.ts#L91-L98) | **STUBBED/UNCONFIRMED (deep-link)** | absent | Real C8 transport (extension? WC? deep-link?) unconfirmed from public docs. **Requires live browser check before any sunset decision. Keep.** |
| bron | OAuth2 popup + remote HTTP API | None, `detectInstalled` always `true` ("remote signer service"), [bron-adapter.ts:106-113](../packages/adapters/bron/src/bron-adapter.ts#L106-L113) | **OAUTH / remote (not CIP-0103)** | absent | Server-side remote signer; fundamentally not injected/WC. Cannot be removed unless Bron exposes CIP-0103. **Keep.** |
| nightly | Injected `window.nightly.canton` (custom callback API) | `window.nightly?.canton` presence, [nightly-adapter.ts:144-161](../packages/adapters/nightly/src/nightly-adapter.ts#L144-L161) | **CUSTOM injected (non-CIP-0103)** | absent | Keep until Nightly exposes a CIP-0103 `window.canton` provider (their template claims CIP-0103, verify live), or until a bridge is built. |

---

## Network-reported status (A1b / A1b-2)

Whether `connect()` sets `session.network` to the wallet's **effective** network
(enabling the SDK's `networkEnforcement` mismatch detection) or merely echoes the
requested `ctx.network`. Echo-only adapters get **no** mismatch detection (no
false positives, but limited protection), this is the
`checkNetworkTruthfulness` conformance contract.

| walletId | network-reported | source |
|---|---|---|
| console | **yes** | `consoleWallet.getActiveNetwork().id` → `session.network` |
| send | **yes** | `status.network?.networkId ?? account.networkId` → `session.network` |
| walletconnect | **yes** | `status.network?.networkId ?? account.networkId` → `session.network` |
| loop | no | SDK connect callback exposes no network → echoes `ctx.network` |
| cantor8 | no | connect response carries no network → echoes `ctx.network` |
| bron | no | API session carries no network → echoes `ctx.network` |
| nightly | no | provider exposes no network → echoes `ctx.network` |

---

## Per-wallet detail

### console: `@partylayer/adapter-console`

- **Transport.** Uses the official `@console-wallet/dapp-sdk` (`consoleWallet`,
  imported at [console-adapter.ts:49](../packages/adapters/console/src/console-adapter.ts#L49)).
  Three modes, `local` (extension via postMessage), `remote` (mobile QR / deep
  link via the consolewallet.io relay), `combined` (auto-detect)
  ([console-adapter.ts:54-72](../packages/adapters/console/src/console-adapter.ts#L54-L72)).
- **Detection.** No direct `window.*` check. `detectInstalled()` calls the SDK's
  `checkExtensionAvailability()` postMessage probe
  ([console-adapter.ts:657-682](../packages/adapters/console/src/console-adapter.ts#L657-L682),
  dispatched from [console-adapter.ts:154-186](../packages/adapters/console/src/console-adapter.ts#L154-L186)).
- **CIP-0103 capabilities implemented.** The adapter drives CIP-0103-shaped SDK
  calls: `status()` ([:289](../packages/adapters/console/src/console-adapter.ts#L289)),
  `getPrimaryAccount()` ([:273](../packages/adapters/console/src/console-adapter.ts#L273)),
  `getActiveNetwork()` ([:279](../packages/adapters/console/src/console-adapter.ts#L279)),
  and `ledgerApi` via a generic `request()` fallback
  ([:592-608](../packages/adapters/console/src/console-adapter.ts#L592-L608)). The
  source comment states "Console Wallet is CIP-0103 compliant"
  ([:545](../packages/adapters/console/src/console-adapter.ts#L545)).
- **Capabilities** ([:125-145](../packages/adapters/console/src/console-adapter.ts#L125-L145)):
  `connect, disconnect, restore, signMessage, signTransaction, submitTransaction,
  ledgerApi, events` plus `injected`/`deeplink`/`remoteSigner` per target.
- **Verdict:** NATIVE (CIP-0103 via the official SDK). Registry marks
  `cip0103.native: true` in both channels.
- **Sunset implication:** The adapter is essentially an SDK wrapper. It can be
  retired once the native provider path covers both the extension path **and**
  Console's remote QR-relay mode (which the bare injected `window.canton` path
  does not provide). **Live-check** whether the Console extension injects
  `window.canton` directly.

### send: `@partylayer/adapter-send`

- **Transport.** Announce-based: Send advertises over `canton:announceProvider`
  and is driven through the extension postMessage `target` channel it announces,
  rather than binding the shared `window.canton` slot
  ([send-provider.ts:1-12](../packages/adapters/send/src/send-provider.ts#L1-L12)).
- **Detection.** Announce-gated. `detectInstalled()`
  ([send-adapter.ts:104-126](../packages/adapters/send/src/send-adapter.ts#L104-L126))
  first calls the cheap browser-readiness gate `isPotentiallyAvailable()`
  ([send-provider.ts:249](../packages/adapters/send/src/send-provider.ts#L249)),
  then `isInstalled()`, which resolves true iff Send announces via
  `canton:announceProvider`, independent of who owns `window.canton`
  ([send-provider.ts:233](../packages/adapters/send/src/send-provider.ts#L233)).
  The `status().kernel.id` read is now a back-compat diagnostic only, not the
  detection path ([send-provider.ts:254](../packages/adapters/send/src/send-provider.ts#L254)).
  Because the channel is scoped to the announcing extension, Send and Console no
  longer collide at the shared `window.canton` slot.
- **CIP-0103 capabilities implemented.** Full OpenRPC method set:
  `status, connect, disconnect, isConnected, getActiveNetwork, listAccounts,
  getPrimaryAccount, signMessage, prepareExecute, prepareExecuteAndWait,
  ledgerApi` ([send-provider.ts:144-188](../packages/adapters/send/src/send-provider.ts#L144-L188)).
- **Missing / fused.** `signTransaction` is intentionally not supported: Send
  fuses sign-and-submit through `prepareExecuteAndWait`
  ([send-adapter.ts:253-262](../packages/adapters/send/src/send-adapter.ts#L253-L262)).
- **Capabilities** ([send-adapter.ts:67-76](../packages/adapters/send/src/send-adapter.ts#L67-L76)):
  `connect, disconnect, restore, signMessage, submitTransaction, ledgerApi,
  events, injected`.
- **Verdict:** NATIVE (CIP-0103 provider, announce-discovered). Registry marks
  `cip0103.native: true` in both channels; the stable entry also carries
  `providerDetection` rules (used for diagnostics, not the announce-gated
  install check).
- **Sunset implication:** The cleanest removal candidate. Once the native
  provider/discovery layer reproduces the `kernel.id` guard (so Send isn't
  mistaken for Console or vice-versa at `window.canton`), dApps can talk to Send
  through the native path and this adapter becomes redundant.

### loop: `@partylayer/adapter-loop`

- **Transport.** QR code / popup over WebSocket via the official
  `@fivenorth/loop-sdk` (`loop`, imported at
  [loop-adapter.ts:38-39](../packages/adapters/loop/src/loop-adapter.ts#L38-L39));
  `loop.init({ options: { openMode: 'popup', requestSigningMode: 'popup' } })`
  ([loop-adapter.ts:141-149](../packages/adapters/loop/src/loop-adapter.ts#L141-L149)),
  connection via `loop.connect()` / `loop.autoConnect()`
  ([:182](../packages/adapters/loop/src/loop-adapter.ts#L182),
  [:275](../packages/adapters/loop/src/loop-adapter.ts#L275)).
- **Detection.** None. `detectInstalled()` always returns `installed: true` in a
  browser because the SDK is bundled
  ([loop-adapter.ts:77-89](../packages/adapters/loop/src/loop-adapter.ts#L77-L89)).
- **CIP-0103.** None. `ledgerApi` is emulated by mapping a fixed set of Canton
  Ledger API routes onto purpose-built SDK methods; the source explicitly says
  "Loop SDK does not expose a generic Ledger API proxy"
  ([loop-adapter.ts:410-471](../packages/adapters/loop/src/loop-adapter.ts#L410-L471)).
  `signTransaction` is unsupported (sign-and-submit fused)
  ([:334-343](../packages/adapters/loop/src/loop-adapter.ts#L334-L343)).
- **Capabilities** ([loop-adapter.ts:57-68](../packages/adapters/loop/src/loop-adapter.ts#L57-L68)):
  `connect, disconnect, restore, signMessage, submitTransaction, ledgerApi,
  events, popup`.
- **Verdict:** WALLETCONNECT-style proprietary SDK (QR + WebSocket). Not
  CIP-0103, not injected. Registry has no `cip0103` flag.
- **Sunset implication:** Cannot be removed by the native+WC milestone unless
  Loop ships a CIP-0103 `window.canton` provider or a standard WalletConnect
  interface PartyLayer can target generically. **Keep** until wallet-side
  CIP-0103 adoption.

### cantor8: `@partylayer/adapter-cantor8`

- **Transport.** `DeepLinkTransport` by default, `MockTransport` in development
  ([cantor8-adapter.ts:64-69](../packages/adapters/cantor8/src/cantor8-adapter.ts#L64-L69)).
- **Detection.** Mobile user-agent sniff only,
  `/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)`, returning
  `installed: isMobile` ([cantor8-adapter.ts:91-98](../packages/adapters/cantor8/src/cantor8-adapter.ts#L91-L98)).
  No `window.*` probe of any kind.
- **Vendor module.** Defaults to `StubCantor8VendorModule`
  ([cantor8-adapter.ts:61](../packages/adapters/cantor8/src/cantor8-adapter.ts#L61)).
  The stub builds deep-link / universal-link URLs (e.g.
  `cantor8://connect?...`) ([vendor.ts:88-116](../packages/adapters/cantor8/src/vendor.ts#L88-L116))
  and **throws "Cantor8 vendor not configured"** when neither `deepLinkScheme`
  nor `universalLinkBase` is set
  ([vendor.ts:113-115](../packages/adapters/cantor8/src/vendor.ts#L113-L115),
  [vendor.ts:170](../packages/adapters/cantor8/src/vendor.ts#L170)).
- **CIP-0103.** None. There is no confirmed live C8 interface in-tree: the
  integration is a deep-link scaffold.
- **Capabilities** ([cantor8-adapter.ts:72-81](../packages/adapters/cantor8/src/cantor8-adapter.ts#L72-L81)):
  `connect, disconnect, restore, deeplink, signMessage, signTransaction`.
- **Public-doc check.** The Cantor8 site (cantor8.tech → redirects to
  cantor8.io) describes a "C8 Enterprise Wallet … self-custody wallet designed
  for institutional operations." It does **not** state whether C8 ships a
  Chrome/browser extension, whether any extension injects a provider
  (`window.canton` / `window.cantor8`), or whether WalletConnect is supported.
  `cantor8.io/about` returns 404.
- **Verdict:** STUBBED/UNCONFIRMED (deep-link). **Requires live browser check.**
- **Sunset implication:** Indeterminate until the real C8 transport is verified
  live. **Keep** and flag for verification.

### bron: `@partylayer/adapter-bron`

- **Transport.** OAuth2 + remote HTTP API via `BronAuthClient` / `BronApiClient`
  ([bron-adapter.ts:30-31](../packages/adapters/bron/src/bron-adapter.ts#L30-L31),
  [:59-77](../packages/adapters/bron/src/bron-adapter.ts#L59-L77)).
  `connect()` opens an OAuth popup with `window.open(authUrl, …)`
  ([:135-139](../packages/adapters/bron/src/bron-adapter.ts#L135-L139)).
- **Detection.** None. `detectInstalled()` always returns `installed: true`
  ("Bron is a remote signer service")
  ([bron-adapter.ts:106-113](../packages/adapters/bron/src/bron-adapter.ts#L106-L113)).
- **CIP-0103.** None. `ledgerApi` is an authenticated HTTP proxy
  (`apiClient.proxyLedgerApi`, [:368](../packages/adapters/bron/src/bron-adapter.ts#L368)).
- **Capabilities** ([bron-adapter.ts:94-104](../packages/adapters/bron/src/bron-adapter.ts#L94-L104)):
  `connect, disconnect, restore, remoteSigner, signMessage, signTransaction,
  ledgerApi`.
- **Implementation note (NOT a bug to fix here).** In production, `connect()`
  expects the OAuth callback to be completed by the host app and throws
  `'OAuth callback not implemented in adapter - handle in app'`
  ([bron-adapter.ts:151-156](../packages/adapters/bron/src/bron-adapter.ts#L151-L156));
  a mock token path runs only under `NODE_ENV === 'development'`.
- **Verdict:** OAUTH / remote signer (enterprise). Not CIP-0103, not injected.
- **Sunset implication:** A server-side remote signer is a different shape from
  an injected/WC wallet; native+WC does not subsume it. **Keep** unless Bron
  exposes a CIP-0103 surface.

### nightly: `@partylayer/adapter-nightly`

- **Transport.** Injected at `window.nightly.canton`: a **custom, non-CIP-0103**
  interface ([nightly-adapter.ts:94-107](../packages/adapters/nightly/src/nightly-adapter.ts#L94-L107)).
  Confirmed against the official docs (read:
  <https://docs.nightly.app/docs/canton/canton/connect/>): Nightly injects at
  `window.nightly.canton`, exposes `connect()`/`disconnect()`, and a
  **callback-based** `signMessage(message, onResponse)`; the docs do **not**
  mention `window.canton`, CIP-0103, or a `getCantonWallets`/`registerWallet`
  Wallet-Standard discovery API.
- **Detection.** `window.nightly?.canton` presence
  ([nightly-adapter.ts:144-161](../packages/adapters/nightly/src/nightly-adapter.ts#L144-L161)).
- **Exact injected interface shape** (from
  [nightly-adapter.ts:42-99](../packages/adapters/nightly/src/nightly-adapter.ts#L42-L99)):
  - `connect(): Promise<{ partyId: string; publicKey: string }>`
  - `disconnect(): Promise<void>`, `isConnected(): boolean`
  - `signMessage(message: string, onResponse: (r: SignRequestResponse) => void): void`: **callback**
  - `createTransferCommand(params): Promise<TransactionCommand>`
  - `submitTransactionCommand(cmd, onResponse: (r: SignRequestResponse) => void): void`: **callback**
  - `getPendingTransactions(): Promise<unknown[] | null>`, `getHoldingUtxos(): Promise<unknown[] | null>`
  - `SignRequestResponse` is a discriminated union over
    `sign_request_approved | sign_request_rejected | sign_request_error`
    ([:43-55](../packages/adapters/nightly/src/nightly-adapter.ts#L43-L55)).
- **CIP-0103 probing.** The adapter opportunistically probes
  `provider.ledgerApi(...)` then `provider.request({ method: 'ledgerApi', … })`
  (CIP-0103-shaped) at runtime "that may be present in newer wallet versions"
  ([nightly-adapter.ts:407-464](../packages/adapters/nightly/src/nightly-adapter.ts#L407-L464)).
  Base interface is still non-CIP-0103.
- **Missing / fused.** `signTransaction` throws `CapabilityNotSupportedError`,
  Nightly fuses signing and submission via `submitTransactionCommand`
  ([nightly-adapter.ts:325-334](../packages/adapters/nightly/src/nightly-adapter.ts#L325-L334)).
- **Capabilities** ([nightly-adapter.ts:127-138](../packages/adapters/nightly/src/nightly-adapter.ts#L127-L138)):
  `connect, disconnect, restore, signMessage, submitTransaction, ledgerApi,
  events, injected`. (Note: `events` is declared as a capability but the adapter
  exposes no `on()` subscription method, wallet-side events are not wired.)
- **Verdict:** CUSTOM injected (non-CIP-0103, `window.nightly.canton`).
- **What a `window.nightly.canton` → CIP-0103 bridge would require:**
  1. Wrap the callback `signMessage` / `submitTransactionCommand` into the
     CIP-0103 `request({ method, params })` Promise shape.
  2. Map `SignRequestResponse` (`approved/rejected/error`) onto CIP-0103
     results and `ProviderRpcError` codes (rejected → 4001, etc.).
  3. Synthesize the CIP-0103 read methods Nightly doesn't expose natively,
     `status`, `getActiveNetwork`, `listAccounts`, `getPrimaryAccount`,
     `prepareExecute`, from `connect()`'s `{ partyId, publicKey }` and the
     transfer-command helpers.
  4. Emit CIP-0103 events (`statusChanged`, `accountsChanged`, `txChanged`).
- **Discrepancy to verify live.** The Nightly Canton template
  (<https://github.com/nightly-labs/canton-web3-template>) README claims it
  "supports the CIP-0103 standard," yet the in-tree adapter targets the legacy
  `window.nightly.canton` callback interface. This suggests Nightly may be (or
  may be moving to) exposing a CIP-0103 `window.canton` provider, **verify in a
  live browser** whether current Nightly builds inject `window.canton`.
- **Sunset implication:** **Keep** until either Nightly ships a CIP-0103
  `window.canton` provider (then it routes through the native path) or the bridge
  above is built.

---

## Manual live-browser checks still required

These cannot be settled from code or public docs and need a human with each
extension/app installed in a real browser:

1. **console**: With the Console extension installed: does it inject
   `window.canton`? Does `window.canton.status().kernel.id` identify Console?
   Confirm CIP-0103 methods resolve (`status`, `getPrimaryAccount`,
   `getActiveNetwork`, `ledgerApi`). Confirm the remote QR-relay mode still
   needs the SDK (i.e. is not reachable via the injected provider).
2. **send**: With the Send extension installed: confirm `window.canton` is
   present and `status().kernel.id` matches `SEND_KERNEL_ID` / the known
   extension IDs in the registry `providerDetection`. Confirm
   `prepareExecuteAndWait` and `ledgerApi` round-trip.
3. **nightly**: With Nightly installed: (a) confirm `window.nightly.canton`
   exists with the callback interface above; (b) **critically**, check whether
   `window.canton` (CIP-0103) is ALSO injected, since the template claims
   CIP-0103 support; (c) confirm `signMessage` fires its callback with an
   `approved` response; (d) check whether `provider.ledgerApi` / `provider.request`
   exist on current builds; (e) check for any WalletConnect support.
4. **cantor8**: Confirm whether C8 ships a Chrome/browser extension and, if so,
   whether it injects a provider (`window.canton` or `window.cantor8`); confirm
   whether C8 supports WalletConnect; confirm the deep-link scheme (is it
   `cantor8://`?) and obtain the real vendor endpoints
   (`universalLinkBase` / `deepLinkScheme` / `connect` / `sign` / `status`); run
   the mobile deep-link connect+sign flow end-to-end. **Until then the cantor8
   integration must be treated as unconfirmed.**
5. **loop**: Confirm whether Loop exposes any CIP-0103 `window.canton` provider
   or only the QR/WebSocket SDK; confirm whether Loop supports WalletConnect.
6. **bron**: Exercise the real OAuth callback completion in a host app (the
   adapter intentionally defers it); confirm whether Bron offers any CIP-0103 or
   WalletConnect endpoint.

---

## Net read for the sunset plan

- **Ready to route natively today:** `send` (true `window.canton` CIP-0103),
  `console` (CIP-0103 via official SDK; live-check `window.canton` injection).
- **Blocked on wallet-side CIP-0103 adoption:** `loop` (QR/WebSocket SDK),
  `nightly` (custom `window.nightly.canton`; bridge or wallet CIP-0103 needed),
  `bron` (OAuth remote signer).
- **Blocked on basic verification:** `cantor8` (stubbed/unconfirmed deep-link).

No adapter should be removed until its row here is upgraded from doc claims to
live-browser-confirmed behaviour.
