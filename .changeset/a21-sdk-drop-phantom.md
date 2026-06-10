---
"@partylayer/sdk": patch
---

A2.1: `listWallets()` aggregation now drops injected discovery entries whose
identity is UNRESOLVED (`identityResolved === false`) instead of synthesizing a
dynamic `browser:ext:<path-id>` entry. This removes the phantom "Canton Wallet"
(`browser:ext:canton`) that appeared when Console's bare `window.canton` slot
exposed no id and its `status()` probe didn't resolve one — the entry's provider
was the slot itself, so clicking it opened Console. The slot's real wallet is
represented by its resolved announce entry (bridged to its adapter) instead.
Correctness is independent of probe timing.
