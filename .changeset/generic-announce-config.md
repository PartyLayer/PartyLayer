---
"@partylayer/sdk": minor
---

Grow `GenericAnnounceAdapter` to per-registry-entry-configurable capabilities (additive; nothing else changes).

An announced wallet with a registry entry (`adapter.transport: 'announce'`) can now opt into the optional CIP-0103 surface via its `capabilities.events` + `adapter.config` — mirroring wagmi's optional-method model. New `AnnounceAdapterConfig` (`events`/`restore`/`ledgerApi`/`metadata`/`mapError`); each optional method is assigned only when configured, so `getCapabilities()` and feature-detection stay honest.

- **events** — `on()` bridges the provider's CIP-0103 `txChanged` → adapter `txStatus`.
- **restore** — silent `status()`/`getPrimaryAccount()` probe + expiry + party-match.
- **ledgerApi** — proxy the standard CIP-0103 `ledgerApi` call.
- **metadata** — richer `session.metadata` on connect when the provider returns it.
- **mapError** — optional programmatic error-translation hook (falls through to the SDK's built-in standard EIP-1193/-1474 mapping).

**Break-nothing / coexistence:** with no config the adapter is byte-identical (3 capabilities, minimal session). A KNOWN wallet with a registered bespoke adapter (e.g. Send) still hits the `adapters.has → continue` bridge branch — untouched. The discovery/popup path (`GenericDiscoveryAdapter`, `warmDiscoveryPlans`, gating, `warmPlans`) and `@partylayer/adapter-send` are not touched. API additive: optional ctor field + optional methods, 0 removed.
