---
"@partylayer/core": patch
---

Mark `MockTransport` `@deprecated`, and say why it is being kept.

Adapters used to accept a `useMockTransport` flag that swapped this class in
beneath them. That flag was removed in `703a645` (the Cantor8 rebuild on its real
SDK); the class outlived its only caller and now has no consumers in this
repository outside its own test. `docs/transports.md` went on instructing
consumers to pass the removed option, which is corrected in the same change.

The deprecation is a signpost, not a scheduled removal. `MockTransport`
implements `openConnectRequest`, `openSignRequest` and `pollJobStatus` — the
popup and deep-link surface, which is exactly the transport family no end-to-end
test currently reaches, since the demo's `window.canton` provider fixture cannot
get there by construction. If that gap is closed, this is the building block.

The JSDoc states all three facts — entry point removed, no consumers today,
retained deliberately — because a deprecation that does not say why something is
still there becomes the next thing someone deletes without checking. No runtime
behaviour changes and the type signature is unchanged.
