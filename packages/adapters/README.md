# Wallet adapters

**This directory is closed to new wallets.** The packages here predate the generic
bridge and are kept for compatibility with dApps already depending on them. They are
not the pattern to copy.

A new wallet integrates through one of the two generic paths, ships **no
PartyLayer-specific code**, and needs at most a registry entry.

## Which path

**If the wallet lives in the page, Path A. If it is a remote service or opens a popup,
Path B.**

- **Path A, announce.** The wallet announces itself over `canton:announceProvider` and
  PartyLayer drives it with no adapter object. A browser extension is the usual case.
- **Path B, discovery adapter.** The wallet ships its own package exporting an object
  that satisfies the official `ProviderAdapter` shape, and the dApp hands that object
  to PartyLayer. A gateway, a hosted wallet, or a popup is the usual case.

A deep link is how a wallet is opened, not a third path. Both paths carry equal weight.

Full guide, including the CIP-0103 methods each path implements:
<https://partylayer.xyz/docs/generic-bridge>

## Registry entry

A Path A wallet works with no registry presence at all. An entry is additive: it puts
the wallet's name and icon in the picker and can opt into optional capabilities
declaratively, still with no code.

```jsonc
{
  "name": "Your Wallet",
  "icon": "https://...",
  "capabilities": { "events": true },
  "adapter": { "transport": "announce" },
  "cip0103": { "native": true }
}
```

`adapter.transport: "announce"` routes the entry through the generic announce path, and
`cip0103.native: true` is the canonical marker that the wallet speaks CIP-0103. Declare
capabilities truthfully: dApps read that snapshot at runtime to decide what to offer, so an
entry that overstates what the wallet implements breaks its own users at the point of use.

How to get an entry published, beta first and then promoted:
[docs/registry-onboarding.md](../../docs/registry-onboarding.md)

## Adding a package here

A gate fails when a new directory appears in this folder, because in almost every case
the answer is one of the two paths above. If a maintainer genuinely needs a new package
here, adding it to the allowlist in
[`scripts/gate/adapters-closed.mjs`](../../scripts/gate/adapters-closed.mjs) is the
conscious act that unblocks it, and the pull request should say why the generic paths
did not fit.
