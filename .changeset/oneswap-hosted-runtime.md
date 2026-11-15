---
'@partylayer/sdk': patch
---

Replace OneSwap's runtime package peer on an older core with the existing generic discovery owner and an independently implemented hosted-popup protocol profile. Preserve supported options and request mapping while isolating each channel's popup and cryptographic request identifiers; uncertain dispatched writes are never replayed or labeled failed without evidence.
