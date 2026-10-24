# Developer discovery and adoption roadmap

PartyLayer aims to become the default wallet connection kit for Canton application developers. Full CIP-0103 compliance positioning remains; individual wallet/network capabilities and acceptance evidence stay explicit. Search placement and adoption are outcomes to measure, not guaranteed deliverables.

## Launch scope

The first implementation includes npm metadata for the five public developer entry points, a linked [RainbowKit for Canton guide](https://partylayer.xyz/docs/rainbowkit-for-canton), [integration support](https://partylayer.xyz/docs/integration-support), an issue form, improved landing/directory entry points and a daily public growth snapshot. Its read-only workflow is installed at `.github/workflows/growth-snapshot.yml` and is active on the default branch; the 2026-10-24 post-publication run passed. Package metadata changes need a new npm publication; merging source alone does not change an existing npm version.

## Workstreams and acceptance

| Priority | Work | Completion evidence | Dependency |
| --- | --- | --- | --- |
| P0 | npm entry-point descriptions, relevant keywords and setup links | New package manifests visible in the public registry | A valid npm publication session or configured trusted publisher |
| P0 | Search discovery and indexing | Production pages return useful HTML, unique titles/canonicals and working links; sitemap accepted and processing observed in Search Console | Google crawl/index scheduling remains external |
| P0 | GitHub product presentation | About/homepage/topics, quick-start README and integration issue form published | Repository maintainer access |
| P0 | Public measurement | Successful daily workflow with dated JSON, job summary and 90-day artifacts | GitHub Actions schedule; no analytics credentials required |
| P1 | Developer activation | New-app and existing-app instructions compile; Next.js/Vite templates build; supported wallet journey verified | Wallet login, approvals and test funding for live acceptance |
| P1 | Wallet documentation distribution | Proposed integration example reviewed and published by each wallet maintainer | Wallet-team agreement; prepared drafts are not sent requests |
| P1 | Application references | Five independent production applications as a 90-day working target | Actual integrations, independent verification and attribution permission |
| P1 | Wallet-team references | Three published wallet documentation integrations as a 90-day working target | Actual maintainer publication, not registry inclusion |
| P2 | Education and scaling | Reusable integration walkthroughs and public case studies based on verified outcomes | Working examples and approved references |

## Query-to-page map

Improve one useful primary page for each intent instead of publishing near-duplicate keyword pages.

| Intent | Primary destination | Useful next action |
| --- | --- | --- |
| Canton wallet SDK / Canton wallet integration | Homepage and installation | Install the kit |
| Canton React wallet / Canton Connect Wallet | Quick start and ConnectButton reference | Mount a complete provider/button example |
| RainbowKit for Canton | RainbowKit for Canton guide | Learn the analogous UI and actual Canton differences |
| CIP-0103 integration | CIP-0103 and generic provider guides | Use the canonical provider path |
| Canton wallet / wallet name | Wallet directory and substantive wallet notes | Understand network/capability/setup, then integrate |
| Framework setup | Installation and quick start | Generate a Vite or Next.js app |

## Measurement contract

Run `pnpm growth:snapshot` locally, or use the **Public growth snapshot** workflow on the default branch. The daily job uses only public npm and GitHub APIs and creates no SDK telemetry, user profiles or ledger data collection. It does not install packages to inflate downloads.

Primary outcome: independently verified production applications using PartyLayer. Supporting indicators: per-package npm weekly/monthly downloads, public dependents where observable, non-branded Search Console clicks/impressions, installation-guide engagement, integration requests and documented onboarding completion. Public source dependencies undercount private applications; neither download counts nor stars are user counts.

Keep React, SDK and CLI downloads separate: transitive installation and CI can count the same application repeatedly. Preserve the API's actual reporting dates, including publication lag. An unavailable source is missing data, never zero. GitHub open issue counts include pull requests. Search Console data and private integration conversations are not automatically exported into the public workflow.

The snapshot also records the first 50 public npm registry API results for `canton wallet` and `canton react wallet`, with positions for the React, SDK and CLI entry points. This measures a repeatable API sample, not npm website ordering. A successful response with an absent package means "not observed in the returned sample"; a failed request remains unavailable and makes the report partial. Neither measure establishes a Google position, AI recommendation or unique application adoption.

A verified application record needs a maintainer-confirmed or observable production URL, version/network evidence, verified functionality, last review date and permission to name/link the project. A mock demo, registry entry, package download or integration discussion is not production adoption. Publish logos only with explicit permission. Keep unapproved partner conversations private.

## Baseline and weekly review

Initial public snapshot collected on 2026-10-24; npm's returned weekly window was 2026-10-16 through 2026-10-22, before the 2026-10-24 coordinated release:

| Package | Weekly downloads | Monthly downloads (2026-09-23–2026-10-22) |
| --- | ---: | ---: |
| `@partylayer/react` | 105 | 605 |
| `@partylayer/sdk` | 151 | 752 |
| `create-partylayer-app` | 14 | 36 |

These counts are aggregate traffic, not verified installations or people. The release's impact cannot be inferred from this preceding window. Compare complete non-overlapping reporting periods and annotate release/test activity.

Weekly maintainer review: inspect query/page performance in Search Console; review new integration requests; verify any proposed reference; compare npm reporting windows; identify the largest onboarding failure; ship the next useful documentation/example fix. Choose numerical traffic/download targets after a full post-release baseline rather than forecasting unsupported multiples.

## External work and ownership

Maintainers send the reviewed messages in [distribution drafts](./distribution-drafts.md). Wallet teams own publication in their documentation, test access and fixes to their deployments. PartyLayer owns the kit, reproducible examples, support and accurate capability reporting. Search Console indexing requests are requests, not promises that Google will index or rank a page.

No paid acquisition, external message sending, partner logo publication or claim of official endorsement is implied by this implementation.

## Continuous technical checks

The daily command also writes `site-health.json` and `site-health.md` alongside the npm/GitHub snapshot. It checks the public robots policy, sitemap format and critical entry points, then fetches up to 100 same-origin sitemap pages with bounded concurrency, timeouts and redirects disabled. HTTP failures, missing titles, incorrect canonicals, noindex directives and policy changes make the job fail while preserving partial evidence. Heading observations are separate content warnings.

This verifies our public HTTP responses. It does not impersonate or verify Googlebot, read Search Console, establish indexing, or measure search rank. A changed robots policy is conservatively flagged for review rather than claiming to implement Google's complete robots parser. The 100-URL bound keeps the existing five-minute workflow budget predictable; review batching before raising it.

`pnpm gate:docs-snippets` compiles the actual README, quick-start, SSR, landing and RainbowKit-for-Canton examples against the public package declarations. It runs inside the required documentation gate, uses temporary module fixtures for documented adjacent application files and deletes them after the check. Installation examples cannot silently pass solely because a copied test fixture is current.

Sitemap entries omit optional modification dates until reliable content dates are available. A fresh build is not evidence that every page changed. Google also ignores priority and change frequency; see the [official sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). These improvements do not diagnose the outstanding Search Console fetch report by themselves.

## AI reference maintenance

`/llms.txt` links to the maintained integration routes; `/llms-full.txt` is generated from the React quick start, SDK README, package versions and stable/beta registry channels. Stable wallet facts come from the stable catalog rather than beta overrides. The reference preserves network/configuration restrictions and separates wallet declarations from live acceptance. It is linked from the docs introduction and repository documentation for developers using coding assistants.

Run `pnpm gen:ai-docs` after updating those sources. The required documentation gate and production prebuild reject output drift, compile the generated React examples and reject broken source/route links. The daily technical report fetches both deployed plain-text references and compares their SHA-256 hashes with the current checkout, exposing unavailable, challenged or old output alongside the HTML page results. A report during deployment can flag a previous deployed version; inspect the release before rerunning.

This is a developer reference, not a guarantee of AI search inclusion. Google's [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) requires no special AI text file or schema; its underlying SEO and indexability requirements still apply. Measure actual referrals and cited links separately before claiming AI visibility increased.
