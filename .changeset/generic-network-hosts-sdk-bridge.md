---
'@partylayer/sdk': minor
---

Generic network-driven host resolution for discovery-adapter wallets. `config.adapters` now also accepts an `OfficialAdapterFactory` (`{ providerId, create(host) }`); the SDK bridges it via `GenericDiscoveryAdapter`, resolves `host = registryEntry.adapter.networkHosts[activeNetwork]` during the connect warm phase, and constructs the official adapter with that host — so an app sets `<PartyLayerKit network="mainnet">` and never hardcodes a wallet URL.

Host resolution + official construction happen synchronously during warm-up (`resolveConnectPlan`), preserving the popup-safe gesture-survival invariant: the prepared/fast connect reaches `adapter.connect()` → `window.open` with no awaited ops. Pre-constructed instances keep working unchanged (explicit host overrides `networkHosts`). A wallet with no host for the active network fails with a clear, network-named error — never a silent wrong-network host.
