---
"@partylayer/adapter-send": minor
"@partylayer/sdk": minor
"@partylayer/registry-client": minor
"@partylayer/react": patch
---

Add Send Canton Wallet adapter (beta).

The adapter implements full Sigilry RPC method coverage: `connect` / `disconnect` / `restore`, `signMessage`, `prepareExecute` and `prepareExecuteAndWait` (CIP-56 transfers), `ledgerApi` proxy, plus `accountsChanged` and `txChanged` events bridged into PartyLayer's `tx:status` channel.

A **kernel.id namespace guard** keeps Send and other splice-wallet-kernel-compatible extensions from claiming each other's `window.canton` provider — Send adapter only forwards calls when `window.canton.kernel.id` matches its Chrome Web Store ID. The same guard pattern is reusable for any future wallet that injects at the bare `window.canton` slot.

`@partylayer/sdk` registers `SendAdapter` in `getBuiltinAdapters()` and exports `SendAdapter` for advanced usage. As a side improvement, the SDK's `tsup` external list now also externalises `cantor8` / `bron` / `nightly` / `send` adapters (previously only `console` + `loop` were external) — bundled SDK dist drops from ~80 KB ESM to ~30 KB ESM with no API changes.

`@partylayer/registry-client` schema gained an optional `RegistryWalletEntry.beta?: boolean` field, surfaced via `WalletInfo.metadata.beta = 'true'`, so any wallet entry can opt into a "Beta" badge in the picker independently of the registry channel file.

`@partylayer/react` renders that Beta badge in the wallet picker modal — generic, not Send-specific.

Send is published on the `beta` registry channel; Send Foundation has indicated production use is not yet recommended.
