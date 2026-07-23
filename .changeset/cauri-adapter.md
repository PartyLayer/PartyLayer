---
'@partylayer/adapter-cauri': minor
'@partylayer/sdk': patch
---

Add Cauri Wallet adapter and register in the beta registry.

`@partylayer/adapter-cauri` bridges PartyLayer to Cauri, a non-custodial
passkey-based remote wallet on Canton. The adapter drives the CIP-103
gateway (JSON-RPC + SSE) via a popup approval flow. Requires runtime
configuration (`apiBase`, `walletUiBase`); re-exported from
`@partylayer/sdk` for opt-in manual registration alongside Bron.

Implements the full CIP-103 method surface: `connect`, `disconnect`,
`isConnected`, `status`, `getActiveNetwork`, `listAccounts`,
`getPrimaryAccount`, `signMessage`, `prepareExecute`, `ledgerApi`.
`signMessage` uses a domain-separated preimage
(`SHA-256("CIP-103.cauri.signMessage.v1" || 0x00 || message_utf8)`) so
the wallet's Ed25519 key cannot be reused as a Canton transaction
signature.

Capabilities: `connect`, `disconnect`, `restore`, `signMessage`,
`signTransaction`, `submitTransaction`, `ledgerApi`, `events`, `popup`,
`remoteSigner`. `restore` probes a persisted session via `isConnected`
and re-opens the SSE stream on success; `sessionExpired` fires when the
backend `statusChanged` SSE reports the session dead.
