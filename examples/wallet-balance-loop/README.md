# Canton wallet holdings example

Vite + React + TypeScript workspace example using the public default wallet catalog,
PartyLayer's ConnectButton and exact token holding summaries. The directory keeps
its historical name; the UI can connect any supported wallet on the configured
Devnet. Reading requires a compatible Token Standard and the active ledgerApi
capability. An authorized application backend is the alternative when the wallet
does not expose ledger reads.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter wallet-balance-loop-example dev
```

Open the Vite URL printed by the command (normally http://localhost:5174).
This checkout uses workspace dependencies. It is not a standalone npm project.
For an independent application, use the published CLI starter and copy the two
example source files after the coordinated package release is available.

The example reads ledger-end and a consistent active-contract snapshot through
the Holding interface. It keeps contract ids, owner, instrument admin/id, exact
decimal amounts and reported locks. Unsafe offsets, incomplete pagination,
duplicate contracts and malformed views produce an error instead of a partial
or invented zero balance. The ready-made account panel and TokenBalances show
available/locked amounts for the current party/network only.

The test fixtures exercise the read-only request contract; they are not live
wallet/ledger acceptance. Loop's separately recorded key-unlock problem and all
remaining live-wallet tests remain in the final acceptance stage.

- [Wallet balances](../../docs/wallet-balances.md)
- [Transaction lifecycle](../../docs/transaction-lifecycle.md)
