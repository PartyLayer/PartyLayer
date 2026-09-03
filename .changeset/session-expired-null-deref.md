---
"@partylayer/sdk": patch
---

Fix a TypeError in `getActiveSession()` when an in-memory session has expired.

`getActiveSession()` called `await this.disconnect()` and then read
`this.activeSession.sessionId` to populate the `session:expired` event.
`disconnect()` sets `this.activeSession` to null on success, so that read threw:

```
TypeError: Cannot read properties of null (reading 'sessionId')
  at PartyLayerClient.getActiveSession src/client.ts:1064:41
```

Every caller of `getActiveSession()` inherited the throw, which includes
`signMessage()` and `submitTransaction()`. The session id is now captured before
`disconnect()` runs.

The other three `session:expired` emit sites were checked rather than assumed.
Two are covered by new tests and are unaffected, because each reads a local
variable captured before the session is cleared. The fourth, the re-probe inside
`listWallets`, is not driven by a test; the test file records why and what would
be needed to drive it.
