---
"@partylayer/sdk": patch
---

Correct the `adapters` JSDoc on `PartyLayerConfig` (and the matching inline comment in the client) so the documented defaults match `getBuiltinAdapters()`. The prose said the defaults were Console, Loop, and Cantor8; the actual no-config defaults are 5N Loop, Cantor8, and Nightly. Console and Send are CIP-0103 native and arrive through the announce path, and Bron and WalletConnect require configuration and are opt-in. Documentation only; no runtime or type-signature change.
