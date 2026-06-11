---
"@partylayer/session": minor
---

Encrypted session persistence core. Adds two
ADDITIVE `SessionStorage` backends — `createEncryptedIndexedDBStorage` (default)
and `createEncryptedLocalStorage` — that encrypt the persisted session at rest
with AES-GCM-256. The key is always generated non-extractable and always stored
in IndexedDB (only the ciphertext blob location varies); a fresh 12-byte IV per
write; origin-bound key/DB/blob naming. Adds a versioned session envelope
(`encodeSessionEnvelope`/`decodeSessionEnvelope` + `migrateSessionEnvelope`
switch-on-version scaffold), `restoreSession` (corrupt/wrong-key/unknown-version/
expired ⇒ null + cleared, never throws), and `reconcileSession` (structured diff
of restored snapshot vs live wallet status). Honest threat model documented:
protects at-rest data + casual inspection; does NOT defend same-origin XSS.
