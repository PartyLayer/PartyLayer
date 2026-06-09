---
"@partylayer/conformance-runner": minor
---

feat: assert session.network is the wallet's effective network

Add the `checkNetworkTruthfulness` contract: an adapter's `connect()` must
surface the wallet's EFFECTIVE network in `session.network` (so the SDK can
detect a network mismatch), not merely echo `ctx.network`. Adapters that
genuinely cannot read the wallet network are recorded as "network-reported: no"
in the support matrix rather than silently passing.
