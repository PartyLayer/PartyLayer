---
"@partylayer/core": minor
"@partylayer/conformance-runner": patch
---

Stop deriving what we require of other people's wallets from what this SDK speaks.

`CIP0103_MANDATORY_METHODS` was `Object.values(CIP0103_METHODS)`. That coupled two
things which are not the same: the CIP-0103 surface this SDK speaks, and the
surface we hold other people's wallets to.

The distinction started mattering the moment the SDK learned a method the
standard does not define. `prepareExecuteAndWait` is declared in the RpcTypes map
published by `@canton-network/core-wallet-dapp-rpc-client` (read at 1.11.0) and is
absent from the specification's synchronous method table. Two adapters here call
it, because one call returning the executed transaction is easier to build a UI
around than a void call plus an event subscription.

So `CIP0103_METHODS` now declares it, with a comment naming its upstream source
and its absence from the spec so nobody removes it to "match the standard".

`CIP0103_MANDATORY_METHODS` is now an explicit list of the specification's ten,
written out rather than derived. It is the yardstick: the conformance suite we
publish iterates it, and a wallet vendor reads the resulting report as a list of
their obligations. Deriving it would have put our extension into that report as
their requirement, which is us telling another team the standard demands
something it does not. That is the same class of error as the wallet-support
claim retracted in CONTRIBUTING.md, and it travels further because it arrives as
a test result rather than as prose.

`cip0103-mandatory-methods.test.ts` fails if the two are recoupled. Its fixture
of the spec's ten is written out independently of both constants, so it can
actually disagree with them; a fixture derived from what it checks would pass
whatever the code did.

**Observable to importers.** `CIP0103_MANDATORY_METHODS` goes from eleven entries
to ten, and `CIP0103_METHODS` gains one. Nothing in this repository depended on
the two being equal, but anyone importing either sees the shape change.
