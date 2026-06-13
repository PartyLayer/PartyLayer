---
'@partylayer/registry-client': minor
---

Decouple the `events` capability from `transactionStatus`. Registry entries now declare an explicit, optional `capabilities.events` flag (emits CIP-0103 provider events); `registryEntryToWalletInfo` derives the `events` capability from THAT, not from `transactionStatus` (which only means the wallet can report tx status). A wallet that can await a tx commit but never emits events (e.g. a popup/remote wallet) no longer falsely advertises `events`. Additive + back-compat: entries without the flag simply don't get the `events` capability.
