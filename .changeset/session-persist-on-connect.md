---
'@partylayer/session': patch
---

Sessions now persist immediately on connect (previously only after the first reload or a party/network switch).

The encrypted session snapshot is written the moment the store first holds both a connected status and a primary account — covering connects the store observes via provider events (`statusChanged`/`accountsChanged`), not just connects made through its own `connect()` or recovered on restore. A session is no longer lost if the tab closes before the first reload. Idempotent: replayed connect events do not re-persist, and the restore and party/network-switch persist paths are unchanged.
