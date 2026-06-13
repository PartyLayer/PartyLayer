---
'@partylayer/react': minor
---

`PartyLayerKit`'s `adapters` prop now also accepts an `OfficialAdapterFactory` (`{ providerId, create(host) }`). The SDK resolves the host from the wallet's registry entry `networkHosts[network]`, so an app sets `<PartyLayerKit network="mainnet">` and never hardcodes a wallet URL — the same source picks the right host across devnet/testnet/mainnet. The pre-constructed `OfficialProviderAdapter` instance form is unchanged.
