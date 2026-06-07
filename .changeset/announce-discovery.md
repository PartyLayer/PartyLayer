---
"@partylayer/provider": minor
---

Add `canton:announceProvider` (EIP-6963-style) wallet discovery.

Some Canton wallets (notably **Send**) do not reliably expose `window.canton`:
when another wallet (e.g. Console) owns the single `window.canton` slot, the
announce wallet was missed. Discovery now ALSO listens for the
`canton:announceProvider` handshake, so announce wallets are found regardless
of who owns `window.canton`.

New additive exports on `@partylayer/provider`:

- `discoverAnnouncedProviders(options?)` — dispatches `canton:requestProvider`
  and resolves each `canton:announceProvider` reply to a working CIP-0103
  provider. The `target` postMessage handshake is delegated to the official
  `@canton-network/dapp-sdk` `ExtensionAdapter` (injectable via
  `options.createProvider` for tests).
- `discoverProviders(options?)` — merges the existing synchronous
  `window.canton` scan with announce results, **deduped by stable provider id**
  (a wallet reachable both ways — e.g. Console — appears exactly once).
- `DiscoveredProvider.icon?` (new optional field) and the `AnnouncedWallet` /
  `AnnounceDiscoveryOptions` types.

`discoverInjectedProviders()` (the `window.canton` scan) is unchanged, as is
its return type. Adds `@canton-network/dapp-sdk` as a dependency for the
`ExtensionAdapter` transport. No behavior change to existing discovery,
`adapter-send`, or any other adapter.
