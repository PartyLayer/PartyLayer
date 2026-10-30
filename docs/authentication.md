# Canton application authentication

Wallet connection grants a dApp access to wallet methods. Application sign-in is
a separate server session. Configure an authentication backend to add sign-in to
the ready-made `ConnectButton`; no new wallet adapter or npm package is required.

This integration follows the backend-callback approach of
[RainbowKit custom authentication](https://rainbowkit.com/docs/custom-authentication).
The readable PartyLayer Canton Sign-In message is an application format, not a
new Canton standard or Sign-In with Ethereum. [CIP-0103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)
defines `signMessage`, but does not require a universal signature algorithm,
encoding or application-session format.

## React integration

Keep the backend integration object stable. All endpoints below belong to the
application; PartyLayer does not host or trust a shared authentication server.

```tsx
import { ConnectButton, PartyLayerKit } from '@partylayer/react';
import type { PartyLayerAuthenticationAdapter } from '@partylayer/react';

async function api(path: string, body?: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Authentication request failed');
  return response.json();
}

const authentication: PartyLayerAuthenticationAdapter = {
  getSession: () => api('session'), // { partyId, networkId } or null
  getChallenge: (identity) => api('challenge', identity),
  verify: (proof) => api('verify', proof), // authenticated identity or null
  signOut: async () => { await api('logout', {}); },
};

export function App() {
  return (
    <PartyLayerKit network="devnet" appName="My app" authentication={authentication}>
      <ConnectButton />
    </PartyLayerKit>
  );
}
```

The connection button displays a separate **Sign in** action after connecting.
It never requests a signature automatically on mount. After sign-in, the account
menu offers **Sign out of app**, which preserves the wallet connection. Omit
`authentication` for connection-only apps. Advanced compositions can nest
`PartyLayerAuthenticationProvider` inside `PartyLayerProvider`.

`useAuthentication()` returns `status` (`loading`, `unauthenticated` or
`authenticated`), `identity`, `isPending`, `canSignIn`, `error`, `signIn()`, `signOut()` and
`refresh()`. Call `refresh()` after an application API returns 401 or when your
backend session changes outside this flow. The backend always enforces its own
session expiry and authorization; a client status is never proof of access.

The provider prepares a server challenge after establishing that sign-in is needed,
without prompting the wallet. Custom buttons should wait for `canSignIn` and call
`signIn()` directly in their click handler: awaiting an HTTP request first can lose
browser user activation and block hosted-wallet popups. Preparation errors offer
retry through `refresh()`. An expired challenge is replaced without automatically
opening the wallet; the user clicks again to approve the new request.

## Server challenge and verification

The [runnable PostgreSQL server reference](../examples/authentication-server)
implements the four endpoints, real configured signature verification, atomic
browser-bound nonce consumption and opaque server sessions. Its test suite uses
actual SQL and generated signing keys. Provision trusted party/key bindings and
verify the selected vendor signing profile before enabling it; synthetic crypto
tests do not certify a live wallet.

Use the server-safe `@partylayer/core/authentication` subpath in your application
backend. Generate randomness on the server, configure the exact origin, and
store the complete challenge bound to the requesting browser's pre-auth session.
The identity supplied to the challenge endpoint is an unverified claim until the
proof is accepted. Rate-limit challenge and verification endpoints.

Declare `@partylayer/core` as a direct dependency of a separate backend package
(`npm install @partylayer/core`). This is the existing shared core package, not
an additional wallet SDK. Do not rely on an application package manager hoisting
another package's transitive dependencies.

```ts
import { randomBytes } from 'node:crypto';
import {
  createAuthenticationChallenge,
  verifyAuthenticationProof,
} from '@partylayer/core/authentication';

// Challenge endpoint, after Origin/CSRF validation and request-body validation:
const challenge = createAuthenticationChallenge({
  origin: 'https://app.example', // trusted configuration, not an unchecked Host header
  partyId: requestedParty,
  networkId: 'canton:da-devnet', // server policy, not an unchecked client network
  nonce: randomBytes(32).toString('base64url'),
  ttlMs: 5 * 60_000,
});
await challenges.insert({ ...challenge, browserSessionId });
// Return challenge JSON with Cache-Control: no-store.

// Verify endpoint, after Origin/CSRF validation and request-body validation:
const identity = await verifyAuthenticationProof({
  origin: 'https://app.example',
  networkId: 'canton:da-devnet',
  proof: { nonce: body.nonce, signature: body.signature },
  consumeChallenge: async (nonce) => {
    // One atomic DELETE ... WHERE nonce = ? AND browserSessionId = ? RETURNING ...
    // in shared storage. Separate GET then DELETE is vulnerable to replay races.
    return challenges.consumeForBrowser(nonce, browserSessionId);
  },
  verifySignatureAndParty: async ({ message, signature, challenge }) => {
    // Application-owned verifier: resolve an independently trusted key authorized
    // for challenge.partyId on challenge.networkId. Use that wallet's documented
    // signing algorithm and strict signature encoding. Verify exact UTF-8 bytes.
    return trustedWalletVerifier.verifyAuthorizedSignature({
      partyId: challenge.partyId, networkId: challenge.networkId,
      message, signature,
    });
  },
});
// Only now rotate/create the application's server session for identity.
```

The database and `trustedWalletVerifier` names above are integration boundaries,
not bundled services. Supply both before enabling sign-in. There is deliberately
no default verifier that assumes every wallet uses Ed25519 or treats a
client-submitted public key as authorized for an arbitrary party. A
cryptographically valid signature alone does not establish Canton party authority.

`formatAuthenticationMessage(challenge)` includes origin, domain, party, CAIP-2
network, nonce, issuance, expiry and version in the signed bytes. Nonce/domain
metadata outside the message does not bind those fields. Helpers reject control
characters, cross-origin/identity mismatches, expired/future challenges and
lifetimes longer than ten minutes. HTTP is allowed only on localhost/loopback.
Every verification attempt consumes its nonce, including a rejected proof.

## Session invalidation

The session endpoint returns only `{ partyId, networkId }` or `null`; it never
returns a wallet access token or signing secret. Create opaque server sessions
using your existing session library, rotate their identifiers after login, and
set cookies `HttpOnly; Secure; SameSite=Lax` (or stricter) with a defined lifetime.
State-changing routes must validate the exact Origin and a CSRF/pre-auth browser
binding; SameSite alone is not a substitute. Logout deletes the server session
and expires its cookie. Sensitive APIs enforce session expiry and party/network
authorization on every request.

PartyLayer immediately removes the authenticated client identity when the
observed wallet, party or network changes, and requests backend logout. A late
verification is revoked if disconnect or unmount happened while it was pending.
Cookie-changing backend calls are serialized to keep late responses from
restoring an obsolete identity. Logout errors remain visible; the UI does not
claim the backend was cleared after a failed request. Server expiry remains
necessary when a tab closes, a device goes offline, or a wallet emits no account
events. Refresh/reconnect that wallet before a new sign-in; do not infer that an
unobserved vendor state remained unchanged.

## Validation and limits

Automated checks cover exact signed fields, a real Ed25519 test key with an
independent party/key mapping, concurrent nonce replay, tampered proof, wrong
party/origin/network, expiry, wallet rejection, duplicate sign-in, late server
responses, disconnect/unmount, restored backend sessions and StrictMode.
The test key is not a claim about any vendor wallet's signing format.

Vendor-specific signature/key-authorization verification and final live-wallet
acceptance are required for each deployed backend integration. This flow signs
an application login challenge; it does not prove token transfers or swaps work.
