# Authorized wallet ledger reads

The ready readers require **SDK 0.21.0 / React 3.2.0 or later**. If those versions
are not yet available on npm during the coordinated rollout, the existing
application-fetcher hooks remain the supported released path.

Install the normal React integration in one command:

```sh
npm install @partylayer/react @tanstack/react-query
```

No wallet-specific PartyLayer package is needed. `useWalletTokenHoldings` adds a
ready reader to the existing application-fetcher hooks. It uses the connected
wallet's CIP-0103 `ledgerApi`; a wallet without that capability still needs an
authorized application backend. Connection alone does not grant arbitrary ledger
access, and an unavailable read is never reported as a zero balance.

## React holdings

Inside `PartyLayerKit` and `QueryClientProvider`:

```tsx
import { ConnectButton, useAccount } from '@partylayer/react';
import { useWalletTokenHoldings } from '@partylayer/react/query';

export function AccountButton({ holdingInterfaceId }: { holdingInterfaceId: string }) {
  const { party, networkId } = useAccount();
  const query = useWalletTokenHoldings({
    networkId: 'canton:da-devnet',
    holdingInterfaceId, // exact package-id:Splice.Api.Token.HoldingV1:Holding
    query: { staleTime: 10_000 },
  });
  return <ConnectButton holdings={party && networkId ? {
    partyId: party, networkId, holdings: query.holdings ?? [],
    loading: query.isPending || query.isFetching, error: query.error,
  } : undefined} />;
}
```

Use the **deployed package id**, not a guessed package hash or unqualified module
name. The query key includes the SDK client, session, wallet, party, active and
expected networks, interface and snapshot limit. Account/source changes do not
reuse another account's result. Previous-account placeholder data and custom
query functions are not exposed in this hook. Existing `useTokenHoldings({read,
key})` remains available unchanged for application-owned transports.

## TypeScript and independent transaction confirmation

```ts
import { createWalletLedgerReader } from '@partylayer/sdk';
import type { PartyLayerClient } from '@partylayer/sdk';

export function ledgerFor(client: PartyLayerClient, holdingInterfaceId: string) {
  return createWalletLedgerReader(client, {
    networkId: 'canton:da-devnet', holdingInterfaceId,
    timeoutMs: 30_000, maxContracts: 1000,
  });
}
```

Pass `reader.confirmTransaction` to `useTransactionFlow({ confirm })`. Capture
the command id **before** submission and pass the same id in the payload and
`flow.submitTransaction({ signedTx: payload }, { commandId: payload.commandId })`.
The reader requires both that original id and a real update id, reads the
ledger transaction for the current party, and compares both ids. A null wallet
acknowledgement or missing/private command id stays `unknown`; it is never
replaced by a local UI id. An app-owned status service can additionally reconcile
its authenticated, server-stored business intent when the wallet loses its reply.

`confirmed` here means correlated **ledger transaction inclusion**. A transfer
instruction can still await acceptance, and a swap deposit can still await output
or refund. Validate operation-specific events and state before reporting business
settlement. Browser journal metadata is not a trusted server intent store.

## Application backend preset

Use `createApplicationLedgerReader(client, { networkId, holdingInterfaceId,
endpoint: '/api/wallet-data', sourceId: 'my-app:devnet' })` for the same scoped
reads through the application's own session. No wallet `ledgerApi` capability is
claimed or required by that transport. In React, supply the stable
`application: { endpoint: '/api/wallet-data', sourceId: 'my-app:devnet' }` option
to `useWalletTokenHoldings`. Query keys include the endpoint and source id.

The [server reference](../examples/authentication-server) provides this optional
endpoint alongside application authentication. It derives party/network from
the server session, rejects mismatched requests and rebuilds every ledger filter
from server policy. The browser cannot select a participant URL, credential or
write endpoint. Sign in to the application first; 401 remains an error.

The version-1 JSON request contains `version`, configured `sourceId`, the expected
`partyId`/`networkId`, one of the three read-only `resource` paths below and its
read body when applicable. The response binds those same fields and adds
`complete: true` and `value` (the raw Ledger API JSON). The SDK rejects changed
identities/sources, missing completeness, HTTP errors, redirects and foreign-origin
endpoints. Cookies are sent only to the application origin; no participant token
is accepted or forwarded by this browser helper. Outside the browser, configure
the exact `origin` explicitly. Backend business authorization still belongs to
the application, independently of these client-side guards.

## Wire contract and limits

The reader implements JSON Ledger API v2 `eventFormat` and the tagged JSON update
format documented by [Digital Asset](https://docs.digitalasset.com/build/3.5/reference/json-api/openapi.html)
and the [CIP-0103 reference schema](https://github.com/digital-asset/canton/blob/37b1b011fc52e3dc369f4bd72e334a011e31c079/community/ledger/ledger-json-api/src/test/resources/json-api-docs/openapi.yaml):

- `GET /v2/state/ledger-end`, then `POST /v2/state/active-contracts` at that offset,
  filtered to the party and exact HoldingV1 interface with interface views.
- `POST /v2/updates/update-by-id` with the current party's transaction event format.
  It does not use the deprecated `transaction-by-id` endpoint.
- Native JSON responses and the existing compatibility `{ response: string }`
  envelope are supported. Unsupported schemas, pagination envelopes, failed views,
  unsafe numeric offsets, duplicates and incomplete reassignments fail closed.
- Amounts remain exact nonnegative Daml Decimal strings. Locks and instrument
  admin/id are retained. Unexpected owners are rejected rather than counted.
- The default snapshot boundary is 1000 contracts; reaching it is an error, not a
  partial portfolio. Large portfolios need the deployment's paginated/indexed
  backend with an explicit completeness guarantee. No client can detect a server
  that silently truncates a supposedly complete array; the wallet/participant
  must honor its documented response contract.
- Reads check live identity before and after requests and have a bounded wait.
  Abort/timeout discards the result; CIP-0103 does not guarantee cancellation of
  an already-issued proxy request. These helpers never prepare, sign or submit.

Wallet authorization policy, deployed JSON API version and token package support
remain prerequisites. Automated fixtures prove parsing, isolation and lifecycle
behavior; they do not certify every vendor deployment.
