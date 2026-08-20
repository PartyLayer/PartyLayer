---
'@partylayer/sdk': patch
---

listWallets now filters to the client's configured channel rather than the literal 'stable'. The channel option now affects listing: a client on channel 'beta' lists the beta entries. A client on stable behaves exactly as before, and includeExperimental still returns everything unfiltered.
