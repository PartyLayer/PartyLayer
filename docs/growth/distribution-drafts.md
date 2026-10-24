# Distribution drafts for maintainer review

These are drafts, not sent messages or agreed partnerships. Send only after checking the recipient and the actual wallet's network/capability evidence. Do not imply that all wallet operations have passed live acceptance.

## Wallet documentation proposal

> We have published PartyLayer's updated Canton wallet connection kit. React apps install `@partylayer/react @tanstack/react-query` and render `PartyLayerKit` plus `ConnectButton`; supported wallet runtimes are included. CIP-0103 remains the provider standard. Would you be open to a short PartyLayer integration example in your dApp documentation, with your actual supported networks and setup requirements? We can prepare the example and verify it together. Quick start: https://partylayer.xyz/docs/quick-start — support: https://partylayer.xyz/docs/integration-support.

Before sending, add the correct wallet-specific link from https://partylayer.xyz/wallets and verify current provider/network information. For Vala retain Devnet beta and resolve the deployment/API and valid-transaction acceptance requirements. For Loop retain the unresolved key-unlock finding until vendor-assisted retesting. Send is Mainnet-only in the current catalog. Never use this generic draft to claim a particular wallet passed all tests.

## Application integration invitation

> If you are building a Canton React app, PartyLayer now includes supported wallet runtimes and a ready-made branded connection experience in one installation. We would like to help you integrate it into a small working branch and verify your actual wallet/network flow. Here is the complete setup: https://partylayer.xyz/docs/quick-start. If useful, we can turn the verified integration into a technical walkthrough with your permission.

Choose a specific application and problem before sending. Offer a reproducible working integration, not guaranteed send/swap outcomes or a guaranteed support SLA.

## Canton Developer Hub listing update

The existing PartyLayer listing should describe the published product accurately. Proposed description:

> Open-source Canton wallet connection kit with a ready-made React Connect Wallet UI, TypeScript SDK, Vue and React Native packages. One React installation includes supported wallet runtimes. Uses CIP-0103 integrations with explicit network, beta and application-credential settings.

Proposed links: https://partylayer.xyz/docs/quick-start, https://github.com/PartyLayer/PartyLayer, https://www.npmjs.com/package/@partylayer/react.

A listing is not a Foundation audit or endorsement. Check the hub's current contribution process and preview the exact diff before submitting it externally.

## Reference publication checklist

- Verify the production URL and that the application actually uses PartyLayer.
- Record versions, network, functions verified and review date.
- Obtain permission for public naming/linking and separate logo permission.
- Link a technical case study with reproducible steps and known limitations.
- Count independent applications once; do not count sample apps, wallets or CI consumers as customer integrations.
