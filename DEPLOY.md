# Deploying the demo apps

Production deploy procedure for the two demo apps, `apps/tokenization` and `apps/dvp`.
Both are static Vite builds served by Caddy on the maintainer's DevNet validator host,
with `/api` reverse proxied to the DevNet gateway. This document covers the apps only.
The gateway itself is covered by [apps/devnet-proxy/RUNBOOK.md](./apps/devnet-proxy/RUNBOOK.md);
bring the gateway up first, since the apps call it in live mode.

## Access

- **Host**: reach the production host through the SSH alias `partylayer-prod`, defined in
  the operator's local ssh config. This is what the `<user>@<validator-host>` placeholder
  under "Sync to the host" resolves to. Host details live in the private ops notes, never
  in this repository.
- **Apps**: served from `/opt/partylayer-apps/<app>`, one directory per app
  (`tokenization`, `dvp`).
- **Gateway**: runs as a plain `docker run` container named `partylayer-devnet-proxy`, not
  under compose and not as a systemd unit. Manage it with `docker ps`,
  `docker logs partylayer-devnet-proxy`, and `docker restart partylayer-devnet-proxy`. Its
  build and run arguments are in
  [apps/devnet-proxy/RUNBOOK.md](./apps/devnet-proxy/RUNBOOK.md).

## Topology

- The apps are static files. Caddy serves each from `/opt/partylayer-apps/<app>` on the
  validator host.
- Each app is built to call its own origin for data. Caddy reverse proxies `/api` on each
  app origin to the gateway, so the browser never talks to the gateway cross origin and
  never holds a ledger token.
- One gateway serves both verticals (see the runbook). The apps differ only in their build.

## Environment (build time)

These are read by Vite at build time and baked into the static output. Set them in the
build shell or a per app `.env.local` (never commit secrets; see .gitignore).

Required for a live deploy:

- `VITE_BACKEND=live` routes every read and submit to the gateway. Unset, or any other
  value, uses the in browser demo backend.
- `VITE_GATEWAY_URL=/api` so the browser calls the app's own origin and Caddy forwards
  `/api` to the gateway.

Optional:

- `VITE_WALLETCONNECT_PROJECT_ID` for your own WalletConnect Cloud project (a shared public
  dev fallback ships so the QR works without it).
- `VITE_BRON_AUTHORIZATION_URL`, `VITE_BRON_TOKEN_URL`, `VITE_BRON_CLIENT_ID`,
  `VITE_BRON_REDIRECT_URI`, `VITE_BRON_API_URL` to surface the enterprise Bron wallet. Bron
  appears in the picker only when all five are set.

## Build

From the repo root, with dependencies installed (`pnpm install --frozen-lockfile`):

```
VITE_BACKEND=live VITE_GATEWAY_URL=/api pnpm --filter partylayer-tokenization build
VITE_BACKEND=live VITE_GATEWAY_URL=/api pnpm --filter partylayer-dvp build
```

Each build runs `tsc && vite build` and writes static output to `apps/<app>/dist/`.

## version.txt convention

Each deploy writes a `version.txt` into the served root so the live build is identifiable
from the browser at `https://<app-origin>/version.txt`. It records the app name, the git
sha that was built, and the build timestamp:

```
app: partylayer-tokenization
sha: <git commit sha built>
build: <ISO 8601 UTC timestamp>
```

Generate it as part of the deploy, after the build and before the sync, for example:

```
printf 'app: partylayer-tokenization\nsha: %s\nbuild: %s\n' \
  "$(git rev-parse HEAD)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > apps/tokenization/dist/version.txt
```

Do the same for `partylayer-dvp` into `apps/dvp/dist/version.txt`. Compare the deployed
`version.txt` against the current `git rev-parse HEAD` to confirm a deploy actually shipped
the intended commit, rather than a stale build.

## Sync to the host

Copy each `dist/` to the validator host with `--delete` so removed files do not linger:

```
rsync -av --delete apps/tokenization/dist/ <user>@<validator-host>:/opt/partylayer-apps/tokenization/
rsync -av --delete apps/dvp/dist/          <user>@<validator-host>:/opt/partylayer-apps/dvp/
```

`<user>` and `<validator-host>` are operator configuration.

## Caddy

Caddy serves each app root and reverse proxies `/api` to the gateway (the gateway listens
on `PORT`, `8787` in the runbook example). One site block per app origin:

```
tokenization.partylayer.xyz {
  root * /opt/partylayer-apps/tokenization
  encode gzip
  handle /api/* {
    reverse_proxy 127.0.0.1:8787
  }
  handle {
    try_files {path} /index.html
    file_server
  }
}

dvp.partylayer.xyz {
  root * /opt/partylayer-apps/dvp
  encode gzip
  handle /api/* {
    reverse_proxy 127.0.0.1:8787
  }
  handle {
    try_files {path} /index.html
    file_server
  }
}
```

The `try_files ... /index.html` fallback keeps the single page app's client routes working.
Reload Caddy after a config change with `caddy reload` or the service manager.

## Post-deploy verification

Run these against each live origin after a deploy:

- `curl -fsS https://<app-origin>/version.txt` shows the sha you just built.
- `curl -fsS https://<app-origin>/api/health` returns `{"ok":true,"mode":"live"}`. A `mode`
  other than `live`, or a non 200, means the gateway is down or misconfigured; fix that
  before announcing the deploy.
- `curl -fsS https://<app-origin>/api/config` lists the parties and the two verticals.
- Load the app in a browser, connect a wallet, and confirm reads render. On the DvP app,
  remember that DevNet reads are empty until the gateway's DevNet has been seeded (see the
  DevNet resets section of the runbook).
- The gateway host has its own read only smoke script; see the runbook's Smoke test section.

## Rollback

Rebuild the previous commit and re-sync, or keep the prior `dist/` and re-`rsync` it. Because
the apps are static, a rollback is a file swap plus a `version.txt` that points back at the
older sha; no gateway change is needed unless the gateway itself regressed.

<!-- BEGIN quality-pass: demo apps quality pass (feat/demo-apps-quality-pass) -->

The two sections below are the deploy-time steps added by the demo apps quality pass. They
complement the generic verification above with the seed and the quality-pass-specific checks.
The curl examples hit the gateway origin directly; behind Caddy the same paths are under `/api`.

## DvP seed (deploy-time step)

The dvp demo (partylayer-dvp) lands on an empty Trades list until the venue creates a
trade. On a fresh live deployment that reads as "nothing here". Seed a few small, real
trades once, after the gateway is live, so the deployed demo shows settleable activity on
first load.

This is a manual deploy-time step. It is NOT run by CI or the build (no package.json
references it). It refuses to run without the explicit `--yes` flag, and it refuses to run
unless the gateway reports live mode.

```
# from the repo root, against the live gateway (--yes is required)
GATEWAY_URL=https://<gateway-host> node scripts/seed-dvp.mjs --yes

# optional: choose how many trades (default 3, clamped to 1..10)
GATEWAY_URL=https://<gateway-host> SEED_COUNT=5 node scripts/seed-dvp.mjs --yes
```

Notes:
- The `--yes` flag is a required confirmation because the script writes real trades to the
  ledger. Without it the script prints a refusal naming the flag and exits non-zero.
- Run it from a host allowed to reach the gateway directly (for example the deploy box);
  the live gateway is network gated, not token authenticated.
- It calls GET /health first and aborts unless mode is "live", so it can never seed a mock
  or misconfigured gateway.
- Re-running adds more trades, it does not reset. Seed once per deployment.

## Post-deploy live verification (quality pass)

After deploying the gateway and the two demo apps, verify the live path with these checks.
Replace <gateway-host> with the deployed gateway origin.

1. Health reports live mode:

```
curl -s https://<gateway-host>/health
# expect: {"ok":true,"mode":"live"}
```

2. Public config returns party display info (labels only, never secrets):

```
curl -s https://<gateway-host>/config
# expect: a JSON object with the demo party display labels
```

3. Tokenization holdings read resolves the party KEY (A3): send the key "alice", not a
   ledger id, and expect holdings back for the real party:

```
curl -s -X POST https://<gateway-host>/tokenization/holdings \
  -H 'content-type: application/json' -d '{"party":"alice"}'
# expect: a JSON array (alice's holdings), or [] if none yet
```

4. DvP trades read returns party KEYS on the legs (A3 reverse map), with the raw ledger
   ids preserved under senderLedgerId / receiverLedgerId:

```
curl -s -X POST https://<gateway-host>/dvp/trades \
  -H 'content-type: application/json' -d '{}'
# expect: each leg's sender/receiver is a key (alice, bob, or venue), and
#         senderLedgerId / receiverLedgerId hold the raw party ids.
# after seeding (see above) this list is non-empty.
```

5. Live cost estimate (B11): a genuine live estimate needs LEDGER_SYNCHRONIZER_ID set on the
   gateway. With it set, expect a cost estimation; without it the endpoint returns null and the
   apps show the illustrative caption.

```
curl -s -X POST https://<gateway-host>/tokenization/transferEstimate \
  -H 'content-type: application/json' \
  -d '{"transfer":{"sender":"alice","receiver":"bob","amount":"1.00","instrumentId":{"admin":"issuer","id":"Amulet"},"requestedAt":"2026-01-01T00:00:00Z","executeBefore":"2026-01-02T00:00:00Z","inputHoldingCids":[],"meta":{}}}'
# expect: {"costEstimation":{...}} when a synchronizer is configured, else {"costEstimation":null}
```

6. In each deployed app, confirm the browser console is clean on load, and that a submit
   under gateway load shows the retry banner (A1 and A2) rather than a raw error.

<!-- END quality-pass -->
