---
"@partylayer/provider": patch
---

Injected discovery accepts an optional list of extra window global paths, so a wallet at its own dedicated global can be found. Announce discovery tolerates alternate id shapes (providerId, id, info.uuid, info.rdns, first non-empty wins) and adds a development-only warning, deduped per event shape, when an announce cannot be consumed. The warning never throws, never blocks discovery, and is silent in production.
