---
"@partylayer/adapter-send": patch
---

Fix: Send is now found/connectable even when another wallet (Console) owns the
shared `window.canton` slot.

Send is announce-only — it advertises via `canton:announceProvider` and routes
RPCs over the splice postMessage `target` channel; it does NOT inject
`window.canton`. The previous transport bound `window.canton` and guarded by
`kernel.id`, so when Console owned the slot, `detectInstalled()` reported
"kernel.id does not match Send" and Send was unconnectable.

`SendProvider` now:
- detects Send via `discoverAnnouncedProviders` from `@partylayer/provider`
  (matching the announce id against the registry `ProviderDetection`
  `provider.id` matchers ∪ `SEND_KNOWN_EXTENSION_IDS`), and
- routes every RPC through the announced `target` extension-channel provider.

`detectInstalled()` is installed iff Send announces (independent of who owns
`window.canton`); its reason text no longer references `window.canton`/`kernel.id`.
The full public `SendProvider` surface is preserved (additive optional
`SendProviderOptions` constructor argument). Adds `@partylayer/provider` as a
dependency (both published). No other adapter is affected.

Note: the splice extension (sync) transport has no inbound push-event channel,
so `on('txChanged')` remains best-effort (tx results come from
`prepareExecuteAndWait`'s response); `on`/`off` are preserved over the channel
event bus.
