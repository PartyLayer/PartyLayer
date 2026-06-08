---
"@partylayer/adapter-walletconnect": minor
---

feat(adapter-walletconnect): derive the WalletConnect CAIP-2 chain from the configured network (ctx.network); explicit chainId still overrides

The official dapp-sdk adapter's `chainId` is now derived from the
PartyLayer-configured network (`ctx.network` → `toCAIP2Network`, e.g. 'mainnet'
→ 'canton:da-mainnet') instead of being left unset (which let dapp-sdk default
to devnet). Precedence: explicit `config.chainId` > derived-from-network >
unset. The memoized official adapter rebuilds when the resolved chain changes
(live network switch); same-chain reuse is preserved, and callers without a
network (signMessage/ledgerApi) never tear down an active session. An invalid
custom network leaves the chain unset (defensive). Backward-compatible: pass an
explicit `chainId` to pin a chain regardless of the configured network.
