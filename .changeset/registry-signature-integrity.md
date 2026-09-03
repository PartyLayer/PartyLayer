---
"@partylayer/registry-client": minor
"@partylayer/core": minor
---

Stop reporting registry verification that did not happen.

Four defects in the signature path, all currently inert because nothing
configures `registryPublicKeys`, and all of which would have shipped broken on
the day signing is enabled.

**A 304 bypassed verification entirely.** On `304 Not Modified` the client
returned the cached registry without checking anything, and when the signature
fetch failed it fabricated `{ algorithm: 'ed25519', signature: '',
keyFingerprint: '' }` and returned it as though all was well. Once keys are
configured most requests are 304s, so the unverified path would have been the
common one rather than an edge case.

A 304 now means only what it says: the served bytes are the ones our ETag names.
That is enough to reuse a cache entry we already verified, and not enough to
call an unverified entry verified. The client only offers `If-None-Match` when
the entry it would revalidate is one it could legitimately reuse, so an
unverified entry causes a full body to be fetched and checked.

**`verified: true` was hardcoded.** Both the cache write and the status update
set it unconditionally, so `RegistryStatus.verified` reported true even in dev
mode where no key is configured and the signature is never requested. It is a
public field the docs tell people to read. It now reflects what actually
happened, including `false` in dev mode.

**A missing signature was indistinguishable from an outage.** Both produced the
fabricated empty signature above. They are now separate outcomes: a `404` or
`410` raises the new `RegistrySignatureMissingError` (a deployment state:
signing not published for this channel), while an unreachable or failing
endpoint raises `RegistryFetchFailedError` (an outage). Either way, a client
holding a previously verified entry keeps serving it rather than going dark, so
the first CDN blip after enabling signing cannot take wallet discovery down.

**A failed verification was silently swallowed.** The refresh error handler fell
back to the last known good entry for every error, including
`RegistryVerificationFailedError`. That is the one case signature checking
exists to catch, and swallowing it left the app working and the operator
uninformed, which is the same as not checking. It now propagates.

The manifest and its signature are also fetched as a unit and verified against
the bytes that call received, rather than fetched independently. The two were
served with different `max-age` values, so a client could pair a fresh manifest
with a stale signature and fail verification on a pair that is valid at the
origin. The CDN header is corrected too, but fetching them together is what
stops the class of bug returning if a header drifts again.

`SignatureOutcome` is exported: a discriminated union whose verified variants
are not constructible without having run the check, so no path can express
success it did not earn.
