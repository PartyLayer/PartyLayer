---
"@partylayer/sdk": minor
---

`GenericAnnounceAdapter` metadata parity (step 2/3 — `signingMethod` via `staticMetadata`, additive). `AnnounceAdapterConfig` gains an optional `staticMetadata?: Record<string, string>` — declarative wallet-specific static values (e.g. `{ signingMethod: 'webauthn-prf' }`), the wagmi connector-property pattern, sourced from the registry `adapter.config.staticMetadata` (string values only).

Merged into `session.metadata` ONLY when `metadata` is enabled, and it FILLS GAPS: runtime RPC values win on a key collision (`{ ...staticMetadata, ...buildMetadata(...) }` — static first, RPC last), per EIP-6963 (the wallet's runtime announce is authoritative) and the project's existing restore idiom. `restore` merges `persisted < static < RPC`.

Byte-identical-safe: gated by the same `metadataEnabled` check (no-config / `metadata:false` adapters never build metadata); a `metadata:true` wallet with no `staticMetadata` is identical to the prior `kernelId` step.
