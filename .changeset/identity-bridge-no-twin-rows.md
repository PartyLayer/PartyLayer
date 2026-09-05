---
'@partylayer/sdk': patch
---

Stop listing a known wallet twice in the picker.

A wallet the picker already knows could be minted a SECOND row beside its own,
in two shapes:

  - an INJECTED provider that resolves a known identity — observed on the demo
    surface, where the demo's own test wallet was listed twice and the twin
    connected to the same provider when clicked;
  - an ANNOUNCE carrying a known registry id — the shape reported for Nightly.

The second is SURFACE-DEPENDENT: the trigger is dispatching
`canton:requestProvider`, which is ordinary announce discovery. Most dApps do it;
our kit demo happens not to, which is the only reason it showed one row there.
That is why "it does not reproduce" was the wrong conclusion.

NIGHTLY ANNOUNCES, observed on a real browser with the extension installed:
`{ id: 'nightly', name: 'Nightly', target: 'nightly', icon: … }`. It does BOTH —
speaks its non-CIP-0103 callback protocol AND announces — which is why an earlier
survey that classified it by protocol concluded it does not.

Console and Send announce too and do NOT duplicate, because their registry
entries carry `providerDetection`. THAT IS WHAT THIS FALLBACK IS FOR: the other
seven wallets, whose matchers have not been observed and are therefore absent.

Both shapes are covered by a test that fails without the fix.

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
