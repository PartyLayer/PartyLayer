---
"@partylayer/session": minor
---

Make `@partylayer/session` a published (non-private) package — its initial
public release in the 0.x range.

It is a real, framework-agnostic package consumed by `@partylayer/react` (via
`workspace:^`) for the `useAccount` / `useAccountEffect` hooks, and a Vue layer
will consume it later. No runtime/logic or public-API changes — only the
`private` flag is removed so publish-coherence validation and the regression
gate treat it as a first-class published `@partylayer/*` package. changesets
releases it ahead of `@partylayer/react`, so the two ship together at the M1
cut with no ordering hazard.
