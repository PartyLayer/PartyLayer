# SEO baseline — 2026-06-12

Factual snapshot of `partylayer.xyz`'s measurable SEO state at the start of the
SEO foundation work (SEO-S1). This is the **before** picture to measure later
slices against.

**Capture date/time:** 2026-06-12, ~13:59–14:20 (Europe/Istanbul, UTC+3), real
browser (Chrome-agent).
**Locale note:** Captured from a Turkish / Istanbul (Ankara IP, `tr-TR`) browser
session — SERP results may differ from US/global.

## (a) Google index coverage — `site:partylayer.xyz`

Observed **3 distinct indexed URLs** (Google displayed **no numeric "About X
results"** figure for this query — all results fit on a single page with no
pagination, even with Tools open).

| # | Indexed URL | Title |
|---|---|---|
| 1 | `https://partylayer.xyz` | PartyLayer — One SDK for Every Canton Wallet |
| 2 | `https://partylayer.xyz/docs` | Introduction - PartyLayer |
| 3 | `https://docs.partylayer.xyz/…` | REST API Reference — Keyvoy - PartyLayer |

## (b) PageSpeed Insights — https://partylayer.xyz

Report timestamp: 12 Haz 2026 13:59:26 (Lighthouse category scores).

| Form factor | Performance | Accessibility | Best Practices | SEO |
|---|:---:|:---:|:---:|:---:|
| Mobile | 77 | 79 | 96 | 100 |
| Desktop | 96 | 89 | 96 | 100 |

## (c) SERP positions

PartyLayer's best position for each query, scanned across the top ~30 organic
results (3 pages). **Scope: `partylayer.xyz` only** — a result on another domain
(e.g. `github.com/PartyLayer`) is recorded as `absent` for this site (see
Findings).

| # | Query | Position |
|---|---|---|
| 1 | `canton wallet sdk` | absent (top 30) |
| 2 | `canton network wallet integration` | absent (top 30) |
| 3 | `cip-0103` | absent (top 30) |
| 4 | `cip 0103 wallet` | absent (top 30) |
| 5 | `canton dapp sdk` | absent (top 30) |
| 6 | `canton wallet adapter` | absent (top 30) |
| 7 | `connect wallet canton` | absent (top 30) |
| 8 | `canton network sdk` | absent (top 30) |
| 9 | `partylayer` | **#1**, page 1, `/` (also **#4**, page 1, `/docs/introduction`) |
| 10 | `canton wallet abstraction` | absent (top 30) |

## Capture method notes

- **SERP pagination:** Google no longer honors `num=30` (single-page large result
  sets), so each query was captured across **three pages** via `start=0`, `start=10`,
  `start=20` (top ~30 organic results per query).
- **`site:` count:** Google shows **no numeric result count** for small domains;
  the figure here is the **observed total of distinct URLs** returned (3), not a
  reported "About X results" number.

## Findings

1. **`docs.partylayer.xyz` is indexed serving Keyvoy content under the PartyLayer
   brand** (result #3 above: "REST API Reference — Keyvoy - PartyLayer"). This
   conflates a different product's docs with PartyLayer in the index. **Flagged
   for the domain-decision slice** — direction already decided: **Keyvoy docs will
   be separated out, and `partylayer.xyz/docs` is the canonical PartyLayer
   documentation.**
2. **`github.com/PartyLayer` ranks on page 1** for two queries where
   `partylayer.xyz` is absent (queries 4 `cip 0103 wallet` and 10 `canton wallet
   abstraction`). The org's GitHub presence is capturing intent the site itself
   is not yet ranking for — a content/authority gap for later slices.

---

_Baseline captured 2026-06-12 (real browser). This dated "before" snapshot
pre-dates the SEO-S2 render fix._
