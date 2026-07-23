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

## 4. Allocate the demo parties and grant the gateway user

1. Allocate three parties on the validator participant: alice, bob, and the venue.
   Record their full party ids.
2. Create or pick the ledger user the gateway authenticates as, and grant it `actAs`
   and `readAs` for all three parties. The gateway acts for all demo parties, which is
   why the DvP createTrade endpoint is documented as demo orchestration.

## 5. Fund alice and bob

Tap the DevNet faucet for alice and bob so they hold Amulet:
use the validator wallet faucet tap for each party until they have a working balance.
The venue needs no balance; it is the settlement executor.

## 6. Obtain the ledger JWT

Obtain a JWT for the gateway's ledger user per the validator's auth setup:

- Static token: if the validator issues a long lived token, use it directly as
  `LEDGER_AUTH_TOKEN`.
- Self signed or client credentials: mint a token per the validator's issuer, then set
  `LEDGER_AUTH_TOKEN` to the result. The gateway keeps the token server side and never
  logs it.

## 7. Configure and run the gateway

Set the environment (all required in live mode unless noted):

```
GATEWAY_MODE=live
LEDGER_JSON_API_URL=<validator JSON ledger API base url>
LEDGER_AUTH_TOKEN=<the ledger JWT>
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
- tokenization.partylayer.xyz and dvp.partylayer.xyz for the two apps on Vercel, each
  built with `VITE_BACKEND=live` and `VITE_GATEWAY_URL=https://gateway.partylayer.xyz`.
- Set `ALLOWED_ORIGINS` to those two app origins so CORS admits them and nothing else.

## 9. Smoke test

Read only, no secret. From the gateway host:

```
GATEWAY_URL=https://gateway.partylayer.xyz node apps/devnet-proxy/scripts/devnet-smoke.mjs
```

It checks `/health` and reads alice's holdings. A passing run prints `smoke: OK`.

## Live wiring notes

The gateway is built on the official wallet sdk (`@canton-network/wallet-sdk` 1.4.0).
Reads use the token standard interface filters over the ledger ACS mapped by the tested
mapping layer; transfer and allocation flows use the sdk transfer and allocation
namespaces; the DvP trade lifecycle exercises the trading app DAR choices above. Issuer
mint and freeze are not available on Canton Coin, since the registry controls Amulet
issuance; the tokenization Issuer panel is visible in live mode with actions disabled
and a short explanation.
