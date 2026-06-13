---
'@partylayer/sdk': minor
---

`listWallets()` now hides `transport: 'discovery-adapter'` registry entries whose matching adapter is NOT registered. A discovery-adapter wallet's provider is supplied by the app (an official ProviderAdapter the SDK bridges under `toWalletId(providerId)`); without it the entry can only fail on click. So such an entry surfaces only when its adapter is present — preventing a broken wallet from appearing for consumers who didn't wire it. No-op when the registry is unavailable or has no discovery-adapter entries; normal (injected/announce) entries are never affected.
