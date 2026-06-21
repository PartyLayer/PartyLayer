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
boundary (`LedgerApiParams`) now accepts a friendly superset — `requestMethod` in
either case (plus `PATCH`) and `body` as a JSON string **or** a plain object — and
each adapter normalizes to what its wallet requires: Send (strict `@sigilry/dapp`
schema) gets a lower-case verb + an object body; CIP-0103 wallets (Console /
Nightly / Bron / WalletConnect / the announce bridge) get an upper-case verb +
a JSON-string body; Loop gets a JSON-string body. New `@partylayer/core` helpers
`normalizeLedgerMethodUpper` + `ledgerApiBodyToString`. Generic docs/examples now
use the canonical `/v2/state/active-contracts` endpoint (Loop aliases the older
`/v2/state/acs`; Send and standard participants require the canonical path).
