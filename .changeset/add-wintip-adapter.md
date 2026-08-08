---
"@partylayer/adapter-wintip": minor
"@partylayer/sdk": minor
---

Add `@partylayer/adapter-wintip`, a first-party adapter for Wintip Wallet (wallet.wintip.cc) — a web-hosted, custodial Canton wallet that injects `window.canton` via a `<script>` tag (no browser extension, no per-user signing key). Registered in the wallet registry via the generic CIP-0103 announce path (same pattern as Console/Send), and `WintipAdapter` is re-exported from `@partylayer/sdk` for opt-in/bespoke use, matching how Console and Send are handled.

`signMessage`/`signTransaction` are intentionally not implemented — Wintip is custodial, so there is no per-user key to sign with client-side; money-moving actions go through `submitTransaction` (Wintip's `prepareExecuteAndWait`), which the wallet's backend executes after its own PIN/passkey approval.
