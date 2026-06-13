---
'@partylayer/react': minor
---

`PartyLayerKit`'s `adapters` prop now also accepts an official `@canton-network` ProviderAdapter (`OfficialProviderAdapter`, e.g. `new WalleyAdapter({ host })`). The SDK auto-bridges it via `GenericDiscoveryAdapter`, so apps can offer popup/remote wallets (like Walley) without a wallet-specific package and without a cast.
