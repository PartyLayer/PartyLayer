---
"@partylayer/react": minor
---

feat(react): optional `walletOrder` on PartyLayerKit/WalletModal to control connect-modal wallet order

New OPTIONAL `walletOrder?: readonly string[]` prop on both `WalletModal` and
`PartyLayerKit` (threaded via context, mirroring `walletIcons`). When provided,
the modal sorts wallets WITHIN the existing CIP-0103 Native / Available sections
by the given id order (case-insensitive, `cip0103:` prefix stripped; unlisted
wallets fall to the end), preserving the section structure. When omitted, the
discovered order is unchanged — fully backward-compatible. RainbowKit `wallets`
parity.
