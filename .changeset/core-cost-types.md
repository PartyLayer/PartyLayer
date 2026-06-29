---
"@partylayer/core": minor
---

Add cost types (CostEstimation, PaidTrafficCost, TrafficCost) for CIP-0104 cost visibility.

These types live in core's source (cost.ts, re-exported from index) and are used by
@partylayer/react and @partylayer/vue, but they were never published, so the published
core lacked them. Consumers that type-check strictly (skipLibCheck off) hit TS2305 when
importing react or vue. This minor bump publishes the cost types. The change is purely
additive: new exports only, nothing removed or changed.
