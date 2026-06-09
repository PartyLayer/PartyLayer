---
"@partylayer/adapter-loop": patch
---

fix(adapter-loop): fail clearly on unsupported networks instead of silently substituting

`mapNetworkToLoop` previously mapped testnet→devnet and unknown→mainnet,
silently connecting to the wrong network. It now returns local/devnet/mainnet
and throws a clear error for anything else (Loop has no testnet), surfaced via
the adapter's existing connect error path.
