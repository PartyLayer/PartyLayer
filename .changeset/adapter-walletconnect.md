---
"@partylayer/adapter-walletconnect": minor
---

Add `@partylayer/adapter-walletconnect` — an opt-in PartyLayer `WalletAdapter`
that wraps the official `@canton-network/dapp-sdk` `WalletConnectAdapter`, so
dApps can connect Canton wallets over WalletConnect (hosted/mobile wallets, e.g.
Nightly mobile).

- Wraps (does not reimplement) the official adapter: SIWX, the `canton_` method
  mapping, `session_event` handling, and restore all come from dapp-sdk.
- Config: `projectId` (required), `metadata`, `onUri` (wire to the connect
  modal's QR UI), optional `signInWithCanton`/`onSignInWithCanton`. `chainId` is
  left unset by default (request the `canton` namespace per the Canton WC spec).
- **Opt-in:** NOT in `getBuiltinAdapters()`. Apps enable it by registering it via
  `config.adapters` and installing the optional `@walletconnect/sign-client` +
  `@walletconnect/types` peers.
- **Lazy:** the dapp-sdk barrel (which statically imports `@walletconnect/sign-client`)
  is loaded only via dynamic `import()` inside `connect()`/`restore()`; importing
  this package's entry pulls neither dapp-sdk nor sign-client, so non-WC
  consumers' webpack/Next builds are unaffected.

Runtime deps: `@partylayer/core` + `@canton-network/dapp-sdk`. `@walletconnect/*`
are optional peers.

Pending (separate step): live WC E2E against a real Canton WC wallet + real
`projectId`.
