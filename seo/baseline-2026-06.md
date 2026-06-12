# SEO baseline — 2026-06-12

Factual snapshot of `partylayer.xyz`'s measurable SEO state at the start of the
SEO foundation work (SEO-S1). This is the **before** picture to measure later
slices against.

> **Capture status.** The values below marked `[PENDING — capture]` could **not**
> be measured from the CI/agent environment: Google `site:` counts and SERP
> positions require an interactive Google session (programmatic Google queries
> are blocked / need the paid Custom Search API), and the PageSpeed Insights
> public endpoint returned `Quota exceeded` without an API key. They need a
> one-time manual capture (browser + PageSpeed UI, or a PSI API key). Each field
> documents exactly how to capture it so the snapshot is reproducible. Everything
> else in this PR (sitemap, robots, JSON-LD, registry headers) is independent of
> these numbers.

## (a) Google index coverage

Query `site:partylayer.xyz` in Google (logged-in, incognito to avoid
personalization) and record the reported result count.

| Metric | Value | Captured |
|---|---|---|
| Indexed pages (`site:partylayer.xyz`) | `[PENDING — capture]` | — |

> Method: Google → `site:partylayer.xyz` → read "About N results". Cross-check
> against Google Search Console → Indexing → Pages (if access exists).

## (b) PageSpeed Insights — https://partylayer.xyz

Run https://pagespeed.web.dev/ for the URL, both form factors (or the PSI API
with a key: `…/pagespeedonline/v5/runPagespeed?url=…&strategy=mobile`).

| Form factor | Performance | LCP | CLS | TBT | Captured |
|---|---|---|---|---|---|
| Mobile | `[PENDING — capture]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | — |
| Desktop | `[PENDING — capture]` | `[PENDING]` | `[PENDING]` | `[PENDING]` | — |

> Attempted from CI via the anonymous PSI API → `Quota exceeded for quota metric
> 'Queries'`. Capture via the PSI web UI, or set a `PAGESPEED_API_KEY` and re-run.

## (c) SERP positions

For each query, record PartyLayer's best position in Google's top 50
(incognito, no personalization, default region). Record **absent** if not in the
top 50.

| # | Query | Position | Captured |
|---|---|---|---|
| 1 | `canton wallet sdk` | `[PENDING]` | — |
| 2 | `canton network wallet integration` | `[PENDING]` | — |
| 3 | `cip-0103` | `[PENDING]` | — |
| 4 | `cip 0103 wallet` | `[PENDING]` | — |
| 5 | `canton dapp sdk` | `[PENDING]` | — |
| 6 | `canton wallet adapter` | `[PENDING]` | — |
| 7 | `connect wallet canton` | `[PENDING]` | — |
| 8 | `canton network sdk` | `[PENDING]` | — |
| 9 | `partylayer` | `[PENDING]` | — |
| 10 | `canton wallet abstraction` | `[PENDING]` | — |

> Method: per query, count organic results to PartyLayer's first appearance
> (1-indexed); ignore ads. `absent` if not present in the first 50 organic
> results.

---

_Scaffold authored 2026-06-12 by the SEO-S1 PR. Fill the `[PENDING]` cells with a
one-time manual/API capture so this file is the dated "before" baseline; do not
backfill an estimated date._
