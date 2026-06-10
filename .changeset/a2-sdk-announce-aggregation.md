---
"@partylayer/sdk": minor
---

A2: SDK-level announce discovery. `listWallets()` now aggregates
`canton:announceProvider` wallets (EIP-6963-style, provider.md) with the
`window.canton` namespace scan, the registry, and registered adapters:

- a known announced id (matching a wallet's `providerDetection` provider.id)
  maps to that adapter — no duplicate picker entry (identity bridge);
- an UNKNOWN announced id is surfaced as a dynamic `browser:ext:<id>` entry
  routed to its own extension `target` via the new `GenericAnnounceAdapter`, so
  future announce-capable Canton wallets appear and route with zero code changes.

Gated by `discovery: { announce?: boolean }` (default ON in the browser, always
skipped under SSR); one-shot cached with a `client.refreshDiscovery()` hook. With
zero announcers, `listWallets()` output is unchanged. New exports:
`GenericAnnounceAdapter`, `announcedWalletId`, `ANNOUNCED_WALLET_ID_PREFIX`.
