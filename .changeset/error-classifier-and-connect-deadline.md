---
'@partylayer/core': minor
'@partylayer/sdk': minor
'@partylayer/adapter-nightly': patch
---

Report what the wallet actually said, and hold the connect deadline you set.

Two defects in one place. `mapUnknownErrorToPartyLayerError` classified errors by
scanning their prose, and both the refusal branch and the timeout branch drew the
wrong conclusion from it.

**A wallet refusing is no longer reported as the user cancelling.** Any message
containing `rejected`, `denied`, `cancelled` or `canceled` collapsed into
`USER_REJECTED`. Nightly declining because the tab was unfocused — "Connect
request rejected - tab is not active" — told the dApp the user had clicked
cancel, when no prompt had been shown at all. Classification now prefers
structured signals (EIP-1193 `4001`, `err.name`), then phrasing that names the
user; anything else that reads as a refusal becomes the new `WALLET_REFUSED`
code, carrying the wallet's own words in `message` and `details.originalMessage`.

**A timeout now reports the deadline that actually elapsed.** `context.timeoutMs`
took precedence over the figure already present in the message, so a connect that
ran the full two minutes was reported as "timed out after 30000ms" — the SDK held
two independent defaults, `120000` at the race and `30000` in the catch block that
formatted the error. There is now one exported `DEFAULT_CONNECT_TIMEOUT_MS`, the
message's own number wins over context, and an unknown deadline says "timed out"
rather than inventing "after 0ms".

**A timeout now cancels.** `Promise.race` never stopped the loser, so a connect
that had timed out kept its popup, QR overlay or socket live and could still
complete against a caller that had given up. `connect()` receives an
`AbortSignal` that fires when the deadline does. Adapters that ignore it behave
exactly as before.

The Nightly adapter had the same shape internally: its protocol names the
outcome (`sign_request_rejected`) and it degraded that to prose for the mapper to
recognise, with a comment noting the word "rejected" was load-bearing. All three
sites now throw the typed error where the type is known, so a Nightly decline no
longer depends on string matching to be classified correctly.

`WALLET_REFUSED` is additive. Code branching on `USER_REJECTED` for a genuine
cancellation is unaffected; code that was relying on `USER_REJECTED` to catch
wallet-side refusals should now also handle `WALLET_REFUSED`.
