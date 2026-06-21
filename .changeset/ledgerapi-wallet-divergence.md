---
"@partylayer/core": patch
"@partylayer/adapter-send": patch
"@partylayer/adapter-loop": patch
"@partylayer/adapter-console": patch
"@partylayer/adapter-nightly": patch
"@partylayer/adapter-bron": patch
"@partylayer/adapter-walletconnect": patch
"@partylayer/sdk": patch
"@partylayer/provider": patch
---

Fix `ledgerApi` wallet divergence so one call works across all wallets. The SDK
boundary (`LedgerApiParams`) accepts a friendly superset — `requestMethod` in
either case (plus `PATCH`) and `body` as a JSON string **or** a plain object — and
each adapter normalizes to what its wallet requires:

- **CIP-0103 RPC wallets** (Send, Console, Nightly, WalletConnect, the SDK
  announce bridge) get the canonical splice-wallet-kernel dApp API shape: a
  **lower-case** verb + an **object** body (`normalizeLedgerMethodLower` +
  `ledgerApiBodyToObject`). `CIP0103LedgerApiRequest` is corrected to this shape.
- **Loop** (Loop SDK) and **Bron** (REST proxy) keep a **JSON-string** body
  (`ledgerApiBodyToString`).

The CIP-0103 provider bridge forwards the verb case and the body type (string or
object) unchanged to the active wallet's adapter — it no longer `String()`-s an
object body into `"[object Object]"`. Generic docs/examples use the canonical
`/v2/state/active-contracts` endpoint (Loop aliases the older `/v2/state/acs`).

No on-wire change for valid Loop/Bron callers or for Send callers already passing
valid input; lower-case + object is the CIP-0103 contract itself, so it cannot
break a conformant wallet.
