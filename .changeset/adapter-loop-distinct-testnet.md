---
'@partylayer/adapter-loop': patch
---

Honor distinct `testnet` network in `mapNetworkToLoop`.

The mapping previously collapsed `devnet` and `testnet` onto Loop's
`devnet`, which routed `testnet` callers to `devnet.cantonloop.com`
and the Canton devnet synchronizer instead of `testnet.cantonloop.com`
and the testnet synchronizer. Cross-participant flows that submitted
on Canton testnet against a Loop wallet party failed with
`UNKNOWN_INFORMEES` because the wallet was connected to a different
network from the submitter.

The Loop SDK already serves a distinct backend per network; pass each
value through unchanged.
