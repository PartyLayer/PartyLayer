'use client';

import { useDocs } from '../layout';

export default function AuthenticationContent() {
  const { H1, H2, P, Code, CodeBlock, Callout, A } = useDocs();
  return <>
    <H1>Canton application authentication</H1>
    <P>Wallet connection and application sign-in are separate. Add your backend to the ready-made
      ConnectButton without installing another wallet adapter or package. This uses a backend
      integration like <A href="https://rainbowkit.com/docs/custom-authentication">RainbowKit custom authentication</A>.
      The readable PartyLayer Canton Sign-In message is an application format; CIP-0103 does not
      standardize an application session or a universal signature algorithm.</P>
    <H2 id="react-integration">React integration</H2>
    <CodeBlock language="tsx">{`import { ConnectButton, PartyLayerKit } from '@partylayer/react';
import type { PartyLayerAuthenticationAdapter } from '@partylayer/react';

async function api(path: string, body?: unknown) {
  const response = await fetch('/api/auth/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Authentication request failed');
  return response.json();
}
const authentication: PartyLayerAuthenticationAdapter = {
  getSession: () => api('session'),
  getChallenge: (identity) => api('challenge', identity),
  verify: (proof) => api('verify', proof),
  signOut: async () => { await api('logout', {}); },
};

<PartyLayerKit network="devnet" appName="My app" authentication={authentication}>
  <ConnectButton />
</PartyLayerKit>`}</CodeBlock>
    <P>Keep the integration object stable. After connecting, the button offers Sign in. It never
      automatically prompts for a signature on mount. Sign out of app preserves the wallet
      connection. Omit authentication for connection-only apps. Advanced compositions nest
      PartyLayerAuthenticationProvider inside PartyLayerProvider.</P>
    <P><Code>useAuthentication()</Code> exposes status, identity, isPending, canSignIn, error, signIn(),
      signOut() and refresh(). Status is loading, unauthenticated or authenticated. Call refresh()
      after an application API returns 401 or the backend session changes elsewhere. Backend
      endpoints enforce their own authorization and expiry.</P>
    <P>The provider prepares a server challenge before the click without requesting a signature.
      Custom buttons wait for canSignIn and call signIn() directly in the click handler, preserving
      browser user activation for hosted-wallet popups. Retry preparation errors with refresh().
      Expired challenges are replaced without opening the wallet automatically; the user clicks again.</P>
    <H2 id="server-challenge-and-verification">Server challenge and verification</H2>
    <P>Use the existing server-safe core helpers. Generate the nonce on the server and store the
      full challenge bound to a pre-auth browser session. The requested identity remains
      unverified until proof acceptance. Rate-limit challenge and verification endpoints.</P>
    <CodeBlock language="ts">{`import { randomBytes } from 'node:crypto';
import { createAuthenticationChallenge, verifyAuthenticationProof } from '@partylayer/core/authentication';

const challenge = createAuthenticationChallenge({
  origin: 'https://app.example',
  partyId: requestedParty, networkId: 'canton:da-devnet',
  nonce: randomBytes(32).toString('base64url'), ttlMs: 5 * 60_000,
});
await challenges.insert({ ...challenge, browserSessionId });

const identity = await verifyAuthenticationProof({
  origin: 'https://app.example', networkId: 'canton:da-devnet',
  proof: { nonce: body.nonce, signature: body.signature },
  consumeChallenge: (nonce) => challenges.consumeForBrowser(nonce, browserSessionId),
  verifySignatureAndParty: ({ message, signature, challenge }) =>
    trustedWalletVerifier.verifyAuthorizedSignature({
      partyId: challenge.partyId, networkId: challenge.networkId, message, signature,
    }),
});
// Only now rotate/create your application's server session for identity.`}</CodeBlock>
    <Callout type="warning">The database and trustedWalletVerifier are application-owned integration
      boundaries. Supply both before enabling sign-in. The verifier must independently authorize
      the signing key for the party/network, then verify exact UTF-8 bytes using the documented
      wallet algorithm and strict encoding. Never assume every wallet uses Ed25519 or trust a
      submitted public key as authority for an arbitrary party.</Callout>
    <P>Validate exact Origin and CSRF/browser binding before processing POST requests. Configure
      origin and allowed networks on the server. Consume a nonce with an atomic database
      delete-and-return scoped to the same browser session; separate read and delete permit replay
      races. Use shared storage across processes and return responses with Cache-Control: no-store.</P>
    <P><Code>formatAuthenticationMessage(challenge)</Code> includes origin, domain, party, network,
      nonce, issuance, expiry and version in the actual signed bytes. Helpers reject ambiguous
      control characters, expired/future challenges, mismatched identity and lifetimes over ten
      minutes. HTTP is allowed only on localhost/loopback. Failed verification also consumes the nonce.</P>
    <H2 id="session-invalidation">Session invalidation</H2>
    <P>The session endpoint returns only partyId/networkId or null. It never returns a signing secret
      or wallet token. Use opaque server sessions, rotate identifiers after login and set cookies
      HttpOnly, Secure and SameSite=Lax or stricter with defined expiry. SameSite alone is not CSRF
      protection. Logout deletes the backend session and expires the cookie. Sensitive APIs enforce
      expiry and party/network authorization on every request.</P>
    <P>Observed wallet, party or network changes clear the authenticated client identity and request
      backend logout. Late verification after disconnect/unmount is revoked. Cookie-changing calls
      are serialized; logout failures remain visible. Server expiry is still necessary when a tab
      closes, a device is offline or a wallet emits no account events. Refresh/reconnect that wallet
      before signing in again.</P>
    <H2 id="validation-and-limits">Validation and limits</H2>
    <P>Automated checks cover exact signed fields, actual test-key cryptography and independent
      party authorization, concurrent replay, tampering, wrong origin/party/network, expiry,
      rejection, duplicate requests, account changes, late responses, disconnect/unmount and
      StrictMode restoration. Test keys do not describe a vendor wallet algorithm. Backend-specific
      key verification and final live-wallet acceptance are still required. Login signatures do
      not prove token transfers or swaps work.</P>
    <P><A href="https://github.com/PartyLayer/PartyLayer/blob/main/docs/authentication.md">Full GitHub guide</A></P>
  </>;
}
