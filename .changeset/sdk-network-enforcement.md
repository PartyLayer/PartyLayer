---
"@partylayer/sdk": minor
---

feat(sdk): network-mismatch detection + enforcement (networkEnforcement, default 'guard') + session:networkMismatch event

Detects when a connected wallet's effective network differs from the dApp's
configured network, flags the session (`session.networkMismatch`), and emits
`session:networkMismatch`. New `networkEnforcement?: 'off' | 'guard' | 'strict'`
config (default `'guard'`): 'strict' also blocks connect; 'guard' blocks
wrong-network transactions; 'off' detects + emits only.

BEHAVIOR: transactions are now blocked on a detected wallet/dApp network
mismatch by default; set `networkEnforcement: 'off'` to restore the previous
always-proceed behavior. The session's `network` now reflects the wallet's
reported network (adapters that read the live wallet); echo-only adapters still
report the configured network, so there is no false positive.
