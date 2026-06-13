---
'@partylayer/testing': minor
---

Add `sessionDataDbName(origin)` — the origin-bound IndexedDB name for the encrypted session DATA (ciphertext envelope) store, counterpart to `sessionKeyDbName`. Lets an E2E assert BOTH encrypted stores (the AES key and the encrypted snapshot) materialized after a connect.
