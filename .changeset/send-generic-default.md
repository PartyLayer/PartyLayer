---
"@partylayer/sdk": patch
---

Send is now served via the generic CIP-0103 announce path by default (the bespoke `SendAdapter` is no longer in `getBuiltinAdapters`); `SendAdapter` remains exported for opt-in manual use. With the registry's `transport:'announce'` Send entry, the SDK constructs a configured `GenericAnnounceAdapter` for Send — metadata/method/restore parity with the previous bespoke adapter, verified by the parity suite, restore re-probe hardening, and a real-extension E2E.
