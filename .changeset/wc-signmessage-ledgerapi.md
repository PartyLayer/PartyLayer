---
"@partylayer/adapter-walletconnect": patch
---

Fix: implement the `signMessage` and `ledgerApi` methods that the adapter
already declared in `getCapabilities()` but never implemented.

Previously the adapter listed `signMessage` and `ledgerApi` as capabilities
while providing no corresponding methods, so `client.signMessage(...)` /
`client.ledgerApi(...)` threw `CapabilityNotSupportedError` in
`@partylayer/sdk` — the request never reached the wallet. Both now delegate to
the official `@canton-network/dapp-sdk` adapter (mirroring `submitTransaction`):

- `signMessage` → `canton_signMessage` (`SignMessageParams { message }` →
  `SignedMessage { signature, partyId, message, … }`).
- `ledgerApi` → `canton_ledgerApi` (proxies a JSON Ledger API request; response
  normalized to `{ response: string }`).

`signTransaction` intentionally still throws (Canton WalletConnect fuses
sign-and-submit — use `submitTransaction` → `canton_prepareSignExecute`).
A capability/method integrity test now asserts every method-capability has a
working method, to catch this class of mismatch.
