---
"@partylayer/react": patch
---

`WalletModal`'s `onConnect` prop is now **optional** (`onConnect?: (sessionId:
string) => void`). A connect modal shouldn't require a connect callback — it
already self-closes via `onClose` on success, and the session is observable via
`useSession()` / `useAccount()`. The success path now calls it conditionally
(`onConnect?.(session.sessionId)`). Backward-compatible widening (existing
callers passing `onConnect` are unaffected); the documented minimal
`<WalletModal isOpen onClose />` snippet now compiles. README reference updated
to the real signature (`(sessionId: string) => void`).
