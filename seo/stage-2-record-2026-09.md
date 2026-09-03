# SEO content build: record and targets, 2026-09-03

What shipped, what each page targets, where its claims come from, and the
position we expect in four weeks. Written now rather than reconstructed later,
so the four-week check is a measurement rather than an argument.

Companion to [`baseline-2026-06.md`](./baseline-2026-06.md), which is the
before picture, and to [`diagnosis-2026-09.md`](./diagnosis-2026-09.md) if it is
present in your checkout.

**Measurement date: 2026-10-01.**

## Baseline being measured against

From Search Console on 2026-09-03: 19 pages indexed, 11 not. Best non-brand
query `canton network sdk` at average position **15.5**, ranking URL the
homepage. Every other target query below: **absent**.

## The pages

| Page | State | Words | Target queries | 4-week target | Sourced from | Staleness |
|---|---|---:|---|---|---|---|
| `/wallets` | new, generated | 669 | `canton wallets`, `canton wallet list`, `which wallets support canton` | top 5 | Our wallet registry: schema-validated on every build, gated against dropped `cip0103.native` flags, published in a public repository so every change is in commit history, served from one HTTPS origin. **Not cryptographically signed.** Transport derived by the shipped registry client | **Self-healing.** Rebuilding reflects the registry |
| `/wallets/<id>` ×6 | new, generated | 641 to 920 | `<wallet> sdk`, `<wallet> integration` | page 1, not #1 | Registry as above, plus our adapter source. Every capability claim is written as a claim about **our adapter**, never about the vendor's product | Registry facts self-heal; hand-written integration notes can rot |
| `/docs/cip-0103` | expanded in place | 856 → 2,218 | `cip-0103`, `cip 0103 wallet`, `canton dapp standard`, `canton dapp api` | top 3, beneath the spec itself | CIP-0103 specification for semantics; `@canton-network/core-wallet-dapp-rpc-client@1.11.0` published type declarations for request and response shapes | **Pinned, unwatched.** Goes stale silently if the spec or the client moves |
| `/docs/quick-start` | expanded | 857 → 1,397 | `canton network sdk`, `how to connect a wallet canton dapp` | 8 to 12 head, top 5 long tail | Our own code for snippets; npm published descriptions for the SDK comparison | Snippets are type-checked in CI. The three version numbers are not |
| `/docs/wagmi-for-canton` | new | 1,129 | `wagmi canton`, `canton for ethereum developers` | 1 or 2 | wagmi's own hook reference at `3.7.7`; Canton-side claims cross-linked to our docs; the `switchNetwork` claim cited to the generated capability matrix | **Weakest.** wagmi renames hooks across majors, which already caught us once |

### On the targets

`cip-0103` is deliberately **not** targeted at #1. The specification on GitHub
has domain authority we cannot match, and an implementation guide sitting
beneath the spec is the honest ceiling. `canton network sdk` is targeted at
8 to 12 rather than #1 for the same reason: the top result is the first-party
package named exactly that. An ambitious target we quietly forget is worse than
a modest one we measure.

## Why the sourcing column exists

Both saves in this stage came from sourcing outward rather than inward.

- Reading the **upstream published types** rather than our own
  `CIP0103_METHODS` revealed the upstream map declares **fourteen keys, not
  ten**, and surfaced six divergences, one of which was our own inconsistency
  (`prepareExecuteAndWait` called by two adapters and missing from the
  constant). Sourcing inward would have printed "ten methods" as settled fact.
- Reading **wagmi's own hook reference** rather than writing from memory caught
  that `useAccount` no longer exists in wagmi 3: the doc page 404s and
  `useConnection` is the current name. That would have been a wrong claim about
  wagmi's most recognisable hook, on a page selling wagmi fluency.

In three months the useful question about any of these pages is not "was it
right when written" but "how do we know it is still true". The column answers
that, and it separates the pages into three tiers rather than one list.

## Deferred: the upstream drift gate

A gate in the style of `gate:docs-drift` would assert that each pinned external
version still exists and that our constants still match the published upstream
surface. That would turn "sourced outward once" into "stays sourced outward".

**Deliberately deferred, 2026-09-03.** Two pinned pages is not yet enough
surface to justify the machinery, and the cheap half is done instead: both
pinned pages state their version and the date it was verified, visible to the
reader, so the eventual gate has exactly one place per page to read the pin
from.

**Build it when either of these happens:**

1. **A third page gets pinned to an external version.** Two is a pair; three is
   a pattern, and the manual check stops being reliable.
2. **A reader finds one of the two pinned pages stale before we do.** That is
   the signal that the honesty of the sourcing is not surviving contact with
   time, which is the thing the gate exists to protect.

Recorded here rather than left to memory so that deferring it stays a decision
with a trigger, rather than becoming an omission nobody owns.

## Verified-against pins, as of this record

| Page | Pinned to | Verified |
|---|---|---|
| `/docs/cip-0103` | `@canton-network/core-wallet-dapp-rpc-client@1.11.0` | 2026-09-03 |
| `/docs/wagmi-for-canton` | `wagmi@3.7.7` | 2026-09-03 |

## What is not claimed

The registry is **not signed**. Signing is implemented in the client but not
enabled: no signature is published for either channel, and verification only
runs when a consumer configures `registryPublicKeys`. No production key exists.
See [`../SIGNING.md`](../SIGNING.md), whose ceremony section opens with the
current status.
