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
  provider.
- `discoverProviders(options?)` — merges the existing synchronous
  `window.canton` scan with announce results, **deduped by stable provider id**
  (a wallet reachable both ways — e.g. Console — appears exactly once). The
  injected entry's stable id is resolved sync-id → capped read-only `status()`
  probe (`provider.id`, no popup) → path id, since live `window.canton`
  (Console) exposes no top-level `id`; announce entries are keyed by their own
  id and are NOT status-probed, so an offline announce wallet (Send) never
  blocks discovery. The direct `window.canton` provider wins the dedup over the
  announce shim.
- `createExtensionChannelProvider` only accepts responses posted on the page's
  own `window` and (when available) matching origin.
- `createExtensionChannelProvider(options?)` — a self-contained CIP-0103
  provider over the splice-wallet `target` postMessage channel (the transport
  for announce wallets). `discoverAnnouncedProviders` uses it by default;
  `options.createProvider` is injectable to substitute another implementation.
- `DiscoveredProvider.icon?` (new optional field) and the `AnnouncedWallet`,
  `AnnounceDiscoveryOptions`, `ExtensionChannelOptions` types.

The `target` postMessage handshake is implemented natively (mirroring the
splice-wallet protocol) rather than via `@canton-network/dapp-sdk`: that
package's single bundled entry statically imports `@walletconnect/sign-client`
(an uninstalled optional peer), which breaks every downstream webpack/Next
build that pulls `@partylayer/provider` into its graph — so it is deliberately
NOT a dependency. No external runtime dependency is added.

`discoverInjectedProviders()` (the `window.canton` scan) is unchanged, as is
its return type. No behavior change to existing discovery, `adapter-send`, or
any other adapter.
