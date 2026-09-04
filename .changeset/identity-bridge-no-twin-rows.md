---
'@partylayer/sdk': patch
---

Stop listing a known wallet twice in the picker.

A wallet whose injected provider resolved an identity could be minted a SECOND
picker row beside its own. Observed twice: Nightly against the real extension,
and the demo's own test wallet, whose twin connected to the same provider when
clicked.

The identity guard was not the gap. It drops entries whose identity did NOT
resolve — an identity-less `window.canton` slot — and correctly lets a resolved
one through. The gap is the identity bridge immediately after:
`findMatchingWalletInfo` consults ONLY `providerDetection`, which 8 of 10
registry entries do not carry and a registered adapter never has. Nothing mapped
the provider back to the wallet already in the list, so the unknown branch minted
a twin.

The fallback matches a resolved provider id against the wallet id and the
declared injection global — IDENTITY FIELDS ONLY. Not the display name: names
are localisable, vendor-changeable and collidable, and two wallets both calling
themselves "Canton Wallet" would silently bridge to each other. That is the same
prose-matching removed from the error classifier, and it does not belong in the
identity bridge either.
