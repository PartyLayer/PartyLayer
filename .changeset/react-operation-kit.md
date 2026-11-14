---
'@partylayer/react': minor
---

Add the optional `/operations` entry point to the existing React package: review
transfer intent before one wallet submission, accept/reject/withdraw pending
instructions, and distinguish ledger inclusion from correlated business outcome.
Keep unknown outcomes explicit, never automatically retry writes, invalidate stale
session/configuration reviews and support all fourteen UI languages. Public
reviews expose immutable input and expiry rather than internal prepared commands.

Add explicit, separately typed HoldingV2 queries and exact account-separated
balances alongside unchanged V1 return types. Preserve the current Connect Wallet
design and keep optional operation code outside its initial import surface.
