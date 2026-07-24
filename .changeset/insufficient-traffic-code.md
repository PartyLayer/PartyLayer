---
"@partylayer/core": minor
"@partylayer/provider": minor
"@partylayer/adapter-loop": patch
---

Classify insufficient traffic errors with their own code.

Traffic exhaustion already reached the kit through the wallet mediated path and was
flattened into a transport error. It now has its own `INSUFFICIENT_TRAFFIC` code with an
`InsufficientTrafficError` class. The generic error mapper recognizes the strings Canton
actually produces (`insufficient traffic` and `AboveTrafficLimit`, case insensitively),
checked before the rejection branch since Canton's real rejection string contains the
word rejected. On the Provider surface the code maps to the existing, spec sanctioned
`-32005` (limit exceeded), which was defined but unused, so no proprietary code is
introduced. The Loop adapter's `PaymentRequiredError` (402) is re-pointed from transport
to `INSUFFICIENT_TRAFFIC`, keeping every detail field.

Synchronizer failures stay out of the taxonomy because they are dApp mediated (Model 2):
they surface inside the dApp's own ledger and registry calls, not the wallet path. That
boundary is now documented in the error codes reference.
