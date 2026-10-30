# Canton application authentication server

A runnable reference for `PartyLayerKit.authentication`. It provides the four
same-origin `/api/auth/{challenge,verify,session,logout}` endpoints from the
[authentication guide](../../docs/authentication.md). It is an application backend,
not a hosted PartyLayer service, wallet adapter or new publishable package.

## Run

From the repository root, use Node 20.12+ and the workspace package manager:

```sh
pnpm install --frozen-lockfile
pnpm --filter @partylayer/core build
pnpm --filter partylayer-authentication-server-example test
```

Tests execute actual PostgreSQL SQL in PGlite and real Ed25519/P-256 cryptography,
HTTP sign-in/logout, concurrent replay attempts and persisted database restoration.
They are synthetic signing profiles, not live vendor-wallet acceptance.

For a server, provision a dedicated PostgreSQL database and configure these
server-only environment variables, then run
`pnpm --filter partylayer-authentication-server-example start`:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact browser application origin; HTTPS except local development |
| `CANTON_NETWORK_ID` | One allowed CAIP-2 Canton network, e.g. `canton:da-devnet` |
| `DATABASE_URL` | PostgreSQL connection URL with the deployment's TLS policy |
| `TRUSTED_PARTY_KEYS_FILE` | Absolute path to operator-provisioned public key bindings |
| `PORT` | Optional loopback port; default `3190` |

The binding file is a JSON array. Every entry explicitly supplies `partyId`,
`networkId`, `publicKeyPem` (SPKI public key), `algorithm` (`ed25519`,
`p256-sha256-der` or `p256-sha256-p1363`), `signatureEncoding` (`base64` or `hex`)
and `messageEncoding` (`utf8` or `base64-text`). There are deliberately no default
party keys or signing profiles. Keep bindings outside the public repository and
verify their authority using trusted onboarding/topology policy. **Never create
a binding from a key supplied by the sign-in request.** Recheck revocation and
rotate the configured bindings according to your application policy.

Verify the exact wallet/version/transport's documented algorithm and bytes before
enabling that profile. `base64-text` means signing the UTF-8 bytes of base64 text,
not a base64-encoded signature. These are different layers. Do not pick a profile
by trial-and-error or assume every CIP-0103 wallet signs the same way.

## Security and deployment contract

- Proxy `/api/auth/*` from the application origin to this **loopback-only** server;
  it enables no cross-origin CORS access. Production TLS terminates at that trusted
  proxy. Forward the original browser Origin unchanged, and do not rewrite it to
  bypass the exact Origin check. Apply edge rate limits as well: the local limiter
  keys on the real socket address and deliberately ignores untrusted forwarded IPs.
- All replicas use the same PostgreSQL database. Nonces are consumed with one
  parameterized `DELETE ... WHERE nonce AND browser RETURNING value`. The browser
  binding is a random HttpOnly pre-auth cookie; a wrong browser cannot consume it.
  Invalid signatures consume the challenge too. No read-then-delete race exists.
- Trusted key bindings authorize a specific party/network independently of proof
  fields. Exact message bytes and strict signature encoding are verified. Changing
  the message, network or party fails. A client-submitted `publicKey` has no effect.
- Session ids rotate after sign-in. Only hashes are stored; cookies are HttpOnly,
  SameSite=Strict and Secure with a `__Host-` name on HTTPS. Localhost HTTP uses
  explicitly development-only cookie names. Sessions expire after one hour.
- Responses are `no-store`. POSTs require the exact configured Origin and JSON
  content type, bodies are bounded, and SQL errors/signatures are never returned
  to the browser. Logout deletes server session and outstanding browser challenges.
- Use a dedicated database/schema and production migrations/permissions before
  deployment. The example creates its four prefixed tables at startup. Add your
  application authorization, operational monitoring, key revocation checks and
  infrastructure controls; the example has no claim of an independent audit.

Application-session authentication does not authorize arbitrary ledger writes.
Never turn this server into a generic participant-admin proxy. Each sensitive API
must validate its own party/network/operation permission on every request.

## Optional authenticated ledger reads

Configure all four server-only values `LEDGER_URL` (trusted participant origin),
`LEDGER_BEARER_TOKEN`, `HOLDING_INTERFACE_ID` (exact deployed HoldingV1 interface)
and `LEDGER_SOURCE_ID` (app-owned source name) to enable `/api/wallet-data`.
Without them, that endpoint is disabled. The configured participant identity must
have the required read rights for the explicitly enabled application parties.
Use least-privilege read credentials; never put this credential in a public
environment variable or accept a replacement from a browser request.

Use `createApplicationLedgerReader` or `useWalletTokenHoldings({ application })`
with that source id and the same-origin endpoint; see the [reader contract](../../docs/wallet-ledger-reader.md).
The server derives party/network from its own authenticated session, permits only
ledger-end, HoldingV1 ACS and update-by-id reads, rebuilds filters and checks the
session again after the read. It never forwards caller-supplied URLs, headers,
party filters, commands or interactive-submission requests. Cross-origin redirects
and non-JSON upstream responses fail. An upstream full-array ACS response is
required; the SDK rejects pagination/schema mismatches and bounded snapshots.

This verifies ledger inclusion, not business settlement or a trusted original
intent. Retain your server-owned intent records and verify transfer/swap-specific
events before authorizing business outcomes. Test-key sign-in and local fake
ledger fixtures are automatic contract tests, not live participant acceptance.
