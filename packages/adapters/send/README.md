# @partylayer/adapter-send

Send Canton Wallet adapter for PartyLayer. Implements the CIP-0103 dApp API via Sigilry's `window.canton` provider, with a `kernel.id`-based namespace guard so installing Send never disturbs other Canton wallet adapters that target the same global injection point.

> **Beta.** Send Foundation has stated this should not be used in production yet. This adapter is published as `0.1.0` to reflect that. Full documentation will land in a follow-up release.
