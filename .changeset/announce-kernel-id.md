---
"@partylayer/sdk": patch
---

`GenericAnnounceAdapter` metadata parity (step 1/3 — `kernelId`, additive). When a configured announce wallet (`config.metadata`) returns a standard splice-wallet-kernel / CIP-0103 `status.kernel.id`, it is now included in `session.metadata.kernelId`. Generic (read from RPC status, not wallet-specific). Fully gated by the existing `metadataEnabled` check — a no-config / `metadata:false` adapter never builds metadata, so behavior is byte-identical; a `metadata:true` wallet whose status has no `kernel` simply omits the key. No public API change.
