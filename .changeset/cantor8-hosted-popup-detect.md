---
"@partylayer/adapter-cantor8": minor
---

Fix Cantor8 availability: a hosted popup is always reachable, so detect reports available instead of waiting for an in-page announcement that never comes.

Cantor8 is a hosted popup wallet (it opens wallet.dev.digik.cantor8.tech through its SDK), so nothing runs in the dApp page to announce over the SDK's `c8#provider_discovery` event. The previous `detectInstalled` subscribed to that event and waited, so it always timed out and reported the wallet permanently unavailable, which hid Cantor8 from the picker. Detection now follows the same gateway contract the official ProviderAdapter path uses (the one Walley connects through): a hosted popup is reachable wherever it can be opened, so detect reports available and the real availability check happens at connect, when the popup opens.

The `detectTimeoutMs` config option is removed, since detection no longer waits.

Note: this is implemented against Cantor8's published SDK (`@cantor8/wallet-connect-sdk`), not yet verified against their live product; a full end to end run still needs the real Cantor8 wallet.
