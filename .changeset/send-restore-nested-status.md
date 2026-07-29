---
"@partylayer/adapter-send": patch
---

Fix Send session restore against current Send builds. `restore()` read a flat `status.isConnected`, but current Send (Sigilry 2.0.0 and later) nests the flag under `status.connection.isConnected`, as the adapter's own constants already noted, so restore returned null on every reload and silently forced a reconnect. It now reads `status.connection?.isConnected` with the flat field as a fallback, so it works against both current and older builds. `SendStatusResponse` gains an optional `connection` field and marks `isConnected` optional to model both shapes.
