# Deploying the demo apps

Production deploy procedure for the two demo apps, `apps/tokenization` and `apps/dvp`.
Both are static Vite builds served by Caddy on the maintainer's DevNet validator host,
with `/api` reverse proxied to the DevNet gateway. This document covers the apps only.
The gateway itself is covered by [apps/devnet-proxy/RUNBOOK.md](./apps/devnet-proxy/RUNBOOK.md);
bring the gateway up first, since the apps call it in live mode.

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
