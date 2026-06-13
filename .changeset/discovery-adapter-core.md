---
'@partylayer/core': minor
---

Add the `OfficialProviderAdapter` duck-type + `isOfficialProviderAdapter` guard and the `AdapterTransport` registry vocabulary.

These let the generic SDK layer host an app-supplied official `@canton-network/core-wallet-discovery` `ProviderAdapter` (e.g. a popup/remote wallet like Walley) by structural shape — we never import `@canton-network/*` and there is no wallet-specific adapter package. `AdapterTransport` (`'injected' | 'announce' | 'discovery-adapter'`) is the additive registry marker for how a wallet's provider is obtained.
