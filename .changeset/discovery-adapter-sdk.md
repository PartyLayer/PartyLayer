---
'@partylayer/sdk': minor
---

Add `GenericDiscoveryAdapter` — a generic bridge that hosts an app-supplied official `@canton-network/core-wallet-discovery` `ProviderAdapter` (e.g. Walley) as a standard wallet, with NO wallet-specific package and no `@canton-network/*` dependency. `config.adapters` now also accepts an `OfficialProviderAdapter`; the SDK auto-detects and wraps it. The official `provider()` is obtained lazily (SSR-safe) and `getCapabilities()` never reports `events` (popup/remote wallets expose the event surface but do not emit).

Also adds a popup-safe connect fast-path: a new public `prepareConnect()` primitive plus background warm-up (on `listWallets`) so a popup/remote wallet's `window.open` is reached synchronously from the user gesture (no Safari popup-block). The normal injected/announce connect path is behavior-unchanged; cold-cache discovery connects fall back to it.
