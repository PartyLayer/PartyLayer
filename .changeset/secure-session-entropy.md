---
"@partylayer/core": patch
---

Generate session IDs with platform cryptographic entropy and fail closed when it is unavailable. Add an optional secure random-bytes hook for native crypto adapters without platform WebCrypto; encryption keys and hardware handles are never session identifiers.
