---
"@partylayer/provider": patch
---

A2 (G4): `discoverAnnouncedProviders` now routes the default announce→provider
factory to `target ?? id` (canonical provider.md: `target` defaults to `id` when
omitted). An announce without an explicit `target` still binds the announcing
wallet's own extension channel — never a shared/undefined slot.
