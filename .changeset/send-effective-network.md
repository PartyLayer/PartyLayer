---
"@partylayer/adapter-send": minor
---

feat: report the wallet's effective network in session.network (enables network-mismatch detection)

`connect()` now sets `session.network` to `status.network?.networkId ??
account.networkId ?? ctx.network` (prefer the wallet-reported network), so the
SDK's `networkEnforcement` can detect a wallet/dApp network mismatch for Send.
Unchanged when the wallet is on the configured network.
