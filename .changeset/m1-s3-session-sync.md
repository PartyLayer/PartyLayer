---
"@partylayer/session": minor
---

Multi-tab sync + party-switch + network-change invalidation. ADDITIVE, opt-in.

- **Multi-tab** via BroadcastChannel (`broadcast` option; origin-bound channel
  using the origin-bound originTag pattern; injectable `channelFactory`). Disconnect in one
  tab propagates to all tabs; a receiving tab applies WITHOUT rebroadcasting
  (loop-safe). Graceful no-op when BroadcastChannel is unavailable (SSR/Node).
- **Party-switch**: `accountsChanged` primary-partyId delta → `party:changed`
  event + `onInvalidate` hook + (with `persistSnapshot`) snapshot rewrite. A list
  reorder keeping the same primary is NOT a switch.
- **Network change**: `statusChanged.network`/`chainChanged` networkId delta →
  `network:changed` + `onInvalidate` + snapshot rewrite.
- **`persistSnapshot`** option: persist the full session envelope (rewritten on
  party/network change) instead of the legacy '1' marker (default off).

New exports: `InvalidationEvent`, `openSyncChannel`, `defaultChannelFactory`,
`BroadcastOptions`, `BroadcastChannelLike`, `BroadcastEnvelope`, `ChannelFactory`,
`SyncChannel`; `SessionEvent` gains `party:changed` + `network:changed`;
`SessionStoreOptions` gains `broadcast` + `persistSnapshot` + `onInvalidate`.
