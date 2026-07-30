# DevNet gateway runbook

Ops guide for running the gateway against real DevNet Amulet. The gateway does all
ledger and registry work server side; the browser never receives a ledger token. Run
these steps on or next to the maintainer's DevNet validator.

Everything before "Configure and run the gateway" is one time validator setup. After
that, GATEWAY_MODE=live serves the two verticals against DevNet.

## 1. Prerequisites

- Daml SDK 3.5.2 (`daml version` should list it; install with the Daml installer).
- Docker (to build and run the gateway image).
- Node 20 (only if you run the gateway or the smoke script outside Docker).
- Access to the maintainer's DevNet validator: its JSON Ledger API URL, its auth setup,
  and rights to upload a DAR and allocate parties.
- The public Scan URL for DevNet Amulet (the registry off ledger API).

## 2. Build the trading app DAR

The DvP venue runs on the official trading app DAR (Apache 2.0). Its Daml source is in
the splice repo.

1. Clone splice at a pinned recent main revision:
   `git clone https://github.com/hyperledger-labs/splice.git && cd splice && git checkout <pinned-revision>`
2. Build the trading app (its data dependencies are prebuilt dars inside the repo):
   `cd token-standard/examples/splice-token-test-trading-app && daml build`
3. The build produces a DAR under `.daml/dist/`. Note its path.

The templates the gateway exercises are `OTCTradeProposal` (choices
`OTCTradeProposal_Accept`, `OTCTradeProposal_Reject`,
`OTCTradeProposal_InitiateSettlement`) and `OTCTrade` (choices `OTCTrade_Settle`,
`OTCTrade_Cancel`), mirrored exactly by the gateway.

## 3. Upload the DAR to the validator

Upload the built DAR to the validator participant:
`daml ledger upload-dar --host <ledger-host> --port <ledger-port> <path-to-trading-app.dar>`

Use the validator's documented auth when the ledger requires it.

## 4. Allocate the demo parties

Allocate three parties on the validator participant: alice, bob, and the venue. Record
their full party ids. They live in the participant's own namespace, so the participant
signs for them; there is no external signing key (see section 6) and submission is a
direct submit-and-wait.

No `actAs` grant is required on this validator. Its ledger API auth is disabled
(`auth-services = []`), so an unauthenticated request already runs with participant
authority and can act for any local party. On a participant with auth enabled you would
instead grant the gateway's ledger user `actAs`/`readAs` for the three parties, and only
then does the gateway need a real token. The gateway acts for all three demo parties,
which is why the DvP createTrade endpoint is documented as demo orchestration.

## 5. Fund alice and bob

Tap the DevNet faucet for alice and bob so they hold Amulet:
use the validator wallet faucet tap for each party until they have a working balance.
The venue needs no balance; it is the settlement executor.

## 6. Ledger auth token

There is no external signing key. The demo parties are local to the participant, so the
participant signs and every write is a direct submit-and-wait; the gateway never runs a
prepare/sign/execute round trip.

Because this validator's ledger auth is disabled, `LEDGER_AUTH_TOKEN` only needs to carry
a `sub` for the user id the wallet sdk labels submissions with; its signature is not
checked. Any minimal token works, and `LEDGER_USER_ID` sets that user id independently
for the direct ledger client. On a participant with auth enabled, set `LEDGER_AUTH_TOKEN`
to a real token for the granted ledger user (section 4) instead. The gateway keeps the
token server side and never logs it.

## 7. Configure and run the gateway

Set the environment (all required in live mode unless noted):

```
GATEWAY_MODE=live
LEDGER_JSON_API_URL=<validator JSON ledger API base url>
LEDGER_AUTH_TOKEN=<ledger token; see section 6>
LEDGER_USER_ID=<user id submissions are labeled with; defaults to devnet-gateway>
SCAN_URL=<public DevNet Scan url>
PARTY_ALICE=<alice party id>
PARTY_BOB=<bob party id>
PARTY_VENUE=<venue party id>
ALLOWED_ORIGINS=<comma list of the tokenization and dvp app origins>
PORT=8787
```

Build and run the image next to the validator:

```
docker build -t partylayer-devnet-proxy apps/devnet-proxy
docker run --rm -p 8787:8787 --env-file gateway.env partylayer-devnet-proxy
```

Then point each app at the gateway with `VITE_BACKEND=live` and
`VITE_GATEWAY_URL=<gateway url>` at build time, and deploy the apps.

## 8. DNS suggestions

- gateway.partylayer.xyz for the gateway host (behind the validator's network).
- tokenization.partylayer.xyz and dvp.partylayer.xyz for the two apps. Both are static
  builds served by Caddy on the validator host from `/opt/partylayer-apps`, with `/api`
  reverse proxied to the gateway. Each app is built with `VITE_BACKEND=live` and
  `VITE_GATEWAY_URL=/api`, so the browser calls its own origin and Caddy forwards `/api`
  to the gateway. See DEPLOY.md at the repo root for the full procedure.
- Set `ALLOWED_ORIGINS` to those two app origins so CORS admits them and nothing else.

## 9. Smoke test

Read only, no secret. From the gateway host:

```
GATEWAY_URL=https://gateway.partylayer.xyz node apps/devnet-proxy/scripts/devnet-smoke.mjs
```

It checks `/health` and reads alice's holdings. A passing run prints `smoke: OK`.

## Interface references must be package-name form

The token-standard interface reads (incoming instructions, allocations, allocation
requests, and the holding view behind the utxos read) filter the ledger active-contract
set by an interface reference. That reference must be the package-name form
(`#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding`), never a pinned
package id. Against this DevNet participant a pinned id matches nothing, because the
participant serves whichever version it vets; the package-name form resolves to that
version. All four references live in one module, `src/live/refs.ts`, so no call site can
pin an id and drift. If a read starts returning empty when you expect data, check this
first.

## DevNet resets

DevNet is periodically reset. When it does, the uploaded DAR, the allocated parties, and
their Amulet balances are all gone. After a reset, re-run sections 2 through 5 (rebuild
and re-upload the DAR, re-allocate alice, bob, and the venue, re-fund alice and bob),
update `PARTY_ALICE`/`PARTY_BOB`/`PARTY_VENUE` to the new party ids, and restart the
gateway. A deployed demo will read empty and its writes will fail until this is done.

## DvP runs on a single instrument

DevNet's registry exposes only the Amulet (Canton Coin) instrument through the token
standard, so the live DvP trade runs both legs as Canton Coin, in opposite directions
between alice and bob. The trading app permits this (it does not require the legs to use
distinct instruments), so the atomic settlement executes exactly as it would with two
instruments; only the instrument on each leg differs. The DvP page states this on screen.

A genuine two instrument DvP (for example cash against a bond) would require standing up
a second token standard registry: a service that serves the transfer factory and
allocation factory for that instrument. DevNet does not provide one, and no such service
runs on this validator. The splice node ships a dummy holding DAR
(`splice-token-test-dummy-holding`), which the trading app example pairs with Amulet in
its own tests; that DAR is the starting point if we ever stand up a second registry.

## Live wiring notes

The gateway is built on the official wallet sdk (`@canton-network/wallet-sdk` 1.4.0).

- Holdings come from the sdk utxos namespace (`sdk.token.utxos.list`, the current holding
  set, not transaction history), mapped through the tested mapping layer.
- Incoming instructions, allocations, and allocation requests read the ledger
  active-contract set filtered by the package-name interface references above. The sdk
  also exposes an allocation fetch, but the ACS path is used for all three so the read
  mechanism is uniform and reuses the tested mapping helpers.
- Instrument metadata and circulating supply come from the Scan registry.
- Transfers use the sdk transfer namespace; allocation create uses
  `sdk.token.allocation.instruction.create` and allocation actions the allocation
  namespace. Each returns a prepared `[command, disclosed]` pair which the gateway
  submits as the acting local party with a direct submit-and-wait (no external key).
- The DvP trade lifecycle exercises the trading app DAR choices above directly.

Issuer mint and freeze are not available on Canton Coin, since the registry controls
Amulet issuance; the tokenization Issuer panel is visible in live mode with actions
disabled and a short explanation.
