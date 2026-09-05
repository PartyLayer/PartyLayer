---
'@partylayer/registry-client': minor
'@partylayer/core': patch
'@partylayer/sdk': patch
'@partylayer/react': patch
---

Give the registry a field for how a wallet connects, and four capabilities it could not express.

One overloaded signal was answering three independent questions: how a wallet is
DISCOVERED, how its SDK is LOADED, and how it CONNECTS. `installation.scriptTag`
says how the SDK is loaded, and it was read as "scan" — which is right for Loop
and wrong for Cantor8, script-loaded but opening a popup.

`connect: ('injected' | 'popup' | 'relay')[]` is now its own field. The shapes
came from surveying all ten wallets rather than from the one that prompted it,
and that ordering paid: Loop and WalletConnect are BOTH `relay` — a QR scanned by
a phone app and a mobile pairing — so a popup-versus-scan flag would have been
wrong for two wallets on day one. Their shared subtitle reads "Connect from
another device", because the axis is where the connection happens, not what the
UI looks like.

ORDER IS PREFERENCE ORDER, and it has a reader: `connect[0]` is what the picker
tries first, and `preferInstalled: false` — the modal's "Try mobile" affordance —
advances to the next entry. Console is `['injected', 'relay']`. That preference
already exists; it is hardcoded in Console's adapter today, and this is where it
belongs instead.

`transfer`, `ledgerApi`, `popup` and `restore` are now expressible.
`walletInfo.capabilities` could never contain them, so
`listWallets({ requiredCapabilities: ['transfer'] })` matched zero wallets while
every adapter implemented `requestTransfer` — two capability gates reading
contradictory sources.

Also fixed: `installHints.deepLinkScheme` was populated from
`installation.scriptTag`, putting an npm package name in a field meaning
`loop://`, while `installation.deeplink` was never mapped at all. Both halves
corrected. Nothing read the field, so it was inert — wrong value, right value
dropped, and it would have shipped broken the day something read it.

No registry entries change here. The data follows once this is published, so no
client sees entries declaring a schema it does not understand.
