---
"@partylayer/sdk": minor
"@partylayer/core": patch
"create-partylayer-app": patch
---

Structured logging with levels and correlation ids, silent by default.

The SDK now follows the library convention that a kit stays silent unless the
application opts in. The default logger is a no-op, so with no logger configured the
client prints nothing. To restore console output, pass `logger: console`; verbosity is
then set with the new `logLevel` config (`debug`, `info`, `warn`, `error`, or
`silent`, defaulting to `info`). Filtering happens centrally in the client, so
adapters never filter themselves.

Every log line now carries a machine readable payload `{ event, correlationId?, ...safe
fields }`, and every emitted event produces one structured log line at a mapped level.
A correlation id is generated at the start of connect, session restore, signTransaction,
and submitTransaction, and threaded through that operation's logs and events so a
multi step flow can be traced end to end. Log payloads follow the same privacy rules as
telemetry: no raw party ids, session ids, transaction hashes, or origins.

The LoggerAdapter interface is unchanged, so a dApp passing plain `console` keeps
working. Behavior change to note: an app that relied on the previous automatic console
output must now pass `logger: console` to see logs.

Also fixes three user visible strings that contained an em dash (a log message, an
error message, and a scaffold template subtitle).
