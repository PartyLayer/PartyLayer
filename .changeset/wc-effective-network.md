---
"@partylayer/adapter-walletconnect": minor
---

feat: report the wallet's effective network in session.network (enables network-mismatch detection)

`connect()` now sets `session.network` to `status.network?.networkId ??
account.networkId ?? ctx.network`. A1 already constrains the requested WC chain;
this makes the session truthful so the SDK can also catch a post-connect network
divergence. Unchanged when the wallet is on the configured network.
