---
'@partylayer/registry-client': minor
---

Add the optional, additive `adapter.transport` field to registry wallet entries (`AdapterTransport`). Absent ⇒ unchanged behavior. `'discovery-adapter'` routes an entry through the SDK's generic official-adapter bridge (matched to an app-supplied `OfficialProviderAdapter` by `adapter.config.providerId`). `validateWalletEntry` now asserts the transport enum when present.
