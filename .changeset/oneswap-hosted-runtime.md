---
'@partylayer/sdk': patch
---

Replace OneSwap's runtime peer on an older core with the existing discovery owner and an independently implemented hosted-popup profile. Preserve supported protocol behavior while isolating each channel's popup and cryptographic request IDs. Uncertain dispatched writes are never replayed or labeled failed without evidence.
