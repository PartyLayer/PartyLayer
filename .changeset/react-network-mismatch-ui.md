---
"@partylayer/react": patch
---

feat(react): surface a network-mismatch state + switch-network message in the connect modal

Adds a `network-mismatch` modal view: on a 'guard'/'off' connect that flags
`session.networkMismatch`, the modal shows "Your wallet is on X, this app
requires Y — switch and reconnect" with Reconnect / All Wallets actions. The
'strict' path (NetworkMismatchError) is handled by the existing error view via a
new `getErrorMessage` case. No new public props.
