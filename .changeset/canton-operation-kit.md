---
'@partylayer/core': minor
'@partylayer/sdk': minor
'@partylayer/adapter-bron': minor
---

Add account-aware HoldingV2 reads alongside unchanged V1 APIs, typed V2 transfer
records and actor-group eligibility, exact account-separated balances and a
server-allowlisted V1/V2 application participant read preset.

Complete the explicitly configured legacy OAuth callback path with same-origin
popup/state/PKCE checks, cancellation and validated token responses. Browser
client secrets and non-PKCE browser authorization are rejected. Vendor endpoint
contracts and live wallet acceptance remain independently validated.

Remove an unnecessary dynamic core-module import from the initial SDK bundle
without changing origin-allowlist enforcement.
