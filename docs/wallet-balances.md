# Wallet balances

Canton holdings are private contracts, not a universal public balance endpoint.
Read them through an authorized application backend or supported wallet ledger
proxy, then supply typed holdings to PartyLayer's default account panel.

## Prerequisites

Connect on the intended network. Authorize the current party/network on the
server and return `TokenHoldingRef[]`: `{ cid, holding: { owner, instrumentId:
{ admin, id }, amount, lock? } }`. Amounts remain decimal strings. A wallet proxy
also requires the active `ledgerApi` capability. These reads do not send funds.

## How the query works

Read a complete active-contract snapshot at a valid ledger offset. Filter by the
Holding interface from the deployed Token Standard, include interface views and
map each contract id/view into the typed shape. Process every page before
displaying a total. Confirm endpoint/version semantics: streaming and paginated
request/response shapes differ.

The [JSON Ledger API reference](https://docs.digitalasset.com/build/3.4/reference/json-api/openapi.html)
documents `activeAtOffset`, `eventFormat` and interface filters. The updated
[wallet holdings example](../examples/wallet-balance-loop) uses the public wallet
catalog and a read-only v2 proxy query (ledger-end then active-contracts). It
validates safe offsets and Holding views and rejects unexpected pagination rather
than reporting a partial balance. A compatible wallet/ledger deployment and
separate live acceptance are still required.

## React

```tsx
import { ConnectButton, useAccount } from '@partylayer/react';
import { useTokenHoldings } from '@partylayer/react/query';
import type { TokenHoldingRef } from '@partylayer/react/query';

function AccountButton() {
  const { party, networkId, isConnected } = useAccount();
  const holdings = useTokenHoldings({
    key: [party, networkId],
    read: async (signal): Promise<TokenHoldingRef[]> => {
      // Your server authenticates/authorizes this party/network and maps its ledger view.
      const response = await fetch('/api/holdings', {
        method: 'POST', credentials: 'same-origin', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId: party, networkId }),
      });
      if (!response.ok) throw new Error('Holdings unavailable');
      return response.json();
    },
    query: { enabled: isConnected && !!party && !!networkId },
  });
  return <ConnectButton holdings={party && networkId ? {
    partyId: party, networkId, holdings: holdings.holdings ?? [],
    loading: holdings.isPending || holdings.isFetching, error: holdings.error,
  } : undefined} />;
}
```

The backend endpoint is application-owned; the sample is not a bundled server.
Do not trust its posted party/network without authorization. The standard panel
renders data only when its exact party and CAIP-2 network match the connected
session. Loading/error states replace balances; a failed read is not zero.

Custom views can render `TokenBalances` with `owner`, `holdings`, `loading`,
`error` and optional `formatInstrument({ admin, id })`. For data-only use:

```ts
import { summarizeTokenHoldings } from '@partylayer/react/query';

const balances = summarizeTokenHoldings(holdings, partyId);
// { owner, instrumentId: { admin, id }, total, available, locked, holdingCount }[]
// All three amount fields are exact decimal strings.
```

## Vanilla JavaScript

The existing core package provides the framework-free summation helper. Declare
core directly (`npm install @partylayer/core`) in a separate backend/vanilla
package; do not depend on transitive hoisting.

```ts
import { sumTokenAmounts } from '@partylayer/core/amounts';

// Same owner AND instrument admin/id only.
sumTokenAmounts(['9007199254740993.1', '0.2']); // '9007199254740993.3'
```

## Notes

Group holdings by both instrument admin and id; names alone are ambiguous.
Never convert token amounts through `Number`, `parseFloat` or a floating-point
reducer. Helpers reject malformed/negative amounts and duplicate/missing
contract ids instead of double-counting or manufacturing zero.

Reported locks remain locked even after their timestamp passes; an updated
ledger view establishes an actual unlock. Totals cover the returned active
holdings, not incomplete assignments, pending transfers, a guarantee of
spendability or full historical activity. Server authorization, complete reads
and final live-wallet acceptance remain separate requirements.
