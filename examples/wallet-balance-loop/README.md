# Wallet Balance — Loop Example

Minimal Vite + React + TypeScript app that connects a Loop wallet and queries token balance via the PartyLayer SDK.

## Quick start

```bash
# From the repo root
pnpm install
pnpm --filter wallet-balance-loop-example dev
```

Open http://localhost:5174 in your browser.

## What it does

1. Connects to Loop wallet via QR code / popup
2. Queries the Active Contract Set (ACS) for a specific template ID
3. Sums `payload.amount.initialAmount` across all matching contracts
4. Displays the balance and raw response

## Template ID format

Loop wallet requires **fully-qualified Daml template IDs** with the package name prefix:

```
#splice-amulet:Splice.Amulet:Amulet       (correct for Loop)
Splice.Amulet:Amulet                       (short form — Console/Nightly only)
```

The default template ID in the example is `#splice-amulet:Splice.Amulet:Amulet`. Change it in the input field to query other templates.

## Reference

- [Wallet Balances docs](https://partylayer.xyz/docs/wallet-balances)
- [useLedgerApi hook](https://partylayer.xyz/docs/hooks#use-ledger-api)
