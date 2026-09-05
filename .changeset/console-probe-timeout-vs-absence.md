---
"@partylayer/adapter-console": patch
---

Stop reporting a timed-out extension probe as a confident "not installed".

Read from the vendor's published source rather than assumed:
`@console-wallet/dapp-sdk`'s `checkExtensionAvailability()`
(`dist/esm/requests/checkAvailability.js`, byte-identical in 2.2.8, 2.2.9 and
2.2.10-beta.1) resolves `{ status: 'notInstalled' }` on its 1000ms timeout and
its outer `catch` returns that value — it never throws. It also writes that
verdict to a module-level cache with no invalidation and no reset export, and its
type admits only `'installed' | 'notInstalled'`, so the vendor cannot express
"did not answer in time" at all.

This adapter handled the timeout in a `catch`, which the vendor never triggers.
The `{ kind: 'unknown' }` branch added for exactly this case was unreachable, and
one slow probe made the picker claim the extension was absent for the life of the
page — with an Install link, for an extension the user already has. Reloading was
the only recovery.

A `notInstalled` answer is now treated as unproven and confirmed with one
`status()` call, which the SDK also exports, which is not cached, and which
rejects rather than resolving a verdict. Three outcomes instead of two: it
answers (installed), it rejects (absent), or our own 2500ms budget expires
(`unknown`, saying so). The budget is ours because the vendor's is not
configurable, and 1000ms is shorter than the 5000ms its own `status()` allows —
which is why a cold MV3 service-worker start loses the race.

The confirming probe is not cached on our side, deliberately: caching a negative
is the defect, and a user can install the extension without reloading the page.
The cost is one bounded probe per detect when the vendor says `notInstalled`.

The test that covered this mocked `checkExtensionAvailability` REJECTING —
a shape the vendor never produces — so it passed while the real path was
unreachable. It is replaced by three cases fed the shape the vendor actually
returns; all three fail against the previous code.
