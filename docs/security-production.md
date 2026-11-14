# Production security guide

PartyLayer supplies wallet discovery, session handling and the supported wallet
request paths. An application remains responsible for its authenticated backend,
participant permissions, asset registry configuration and business authorization.
A successful wallet connection or message signature is not proof that a transfer
or swap has settled.

## HTTPS requirements

Serve production applications and authenticated application endpoints over HTTPS.
Keep the configured application origin aligned with the actual browser origin.
Web Crypto, passkeys, browser storage and popup authorization depend on the
browser's secure-context and origin rules. Local loopback development is a
separate environment, not a production deployment configuration.

## Content Security Policy (CSP)

Build the policy for the application's framework and the wallets actually enabled
on its configured network. PartyLayer's npm integration bundles reviewed runtimes
and loads optional wallet/discovery chunks as needed. It does not require a
remote JavaScript CDN to load the Loop runtime. Do not copy an old wallet-domain
allowlist: use the current registry/network configuration and each vendor's
integration documentation.

This is a restrictive starting point for a client-rendered application whose
scripts are external files served by the application. It is not a complete
allowlist for every wallet, an SSR framework, or optional third-party services:

```text
default-src 'self';
base-uri 'self';
object-src 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://registry.partylayer.xyz;
img-src 'self' data: https://registry.partylayer.xyz;
frame-src 'self';
frame-ancestors 'self';
form-action 'self';
```

Add the reviewed connection/frame/image origins required by the enabled wallet
transports. A custom registry requires its actual origin. Permit only the
configured service origins; do not automatically turn untrusted catalog data into
an unrestricted CSP. The React UI uses inline style attributes, which must be
accounted for by the application's styling policy.

SSR frameworks may emit inline bootstrap scripts. Follow the framework's nonce
or hash integration rather than pasting a fixed nonce into a static hosting
configuration. For Next.js, use its [CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)
and the documentation for your framework version. A nonce is unpredictable and
unique per response. Test both the production build and the real wallet journey
before enforcing the policy.

The PartyLayer marketing site's optional Cloudflare measurement needs its
explicit script/connection sources; that measurement is not injected into SDK
consumers. See [website measurement](website-analytics.md).

## Platform-specific configuration

Apply response headers through the application's hosting/framework integration
(Vercel, Netlify, Cloudflare or a self-hosted server). The host does not determine
a universal wallet allowlist. Nonce-based SSR policies require response-time
coordination with the renderer and cannot be implemented with a hardcoded nonce
in a static headers file.

Keep popup behavior in the review. Cross-Origin-Opener-Policy can sever the
relationship between an OAuth popup and its opener. Applications using a popup
callback must choose compatible isolation headers and validate the returned
window source, origin and single-use authorization state. Do not weaken isolation
for unrelated routes without assessing the application requirement. Refer to the
[COOP header documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy).

## Pre-deployment checklist

Use the repository's build, type, lint, conformance, API, package-content and clean
consumer checks as release evidence. Record actual wallet versions, network,
connect/reject/sign/restore/disconnect and funded transaction outcomes separately
in [wallet acceptance](wallet-acceptance.md). Mock transports, emulated mobile
screens and an automated accessibility scan do not certify a physical passkey,
a live wallet account or a financial settlement.

Inspect the effective production response headers and browser console. Verify
that the enabled wallet flow works under those headers. Source examples or a
passing local development page alone do not demonstrate production compatibility.

## Security best practices

Keep signing keys, recovery phrases, participant credentials, client secrets and
API keys out of browser bundles, logs and the public repository. A public website
analytics site id is not an account-management API credential. Do not add npm or
GitHub publishing credentials to source; use the maintainer-protected release
workflow and the existing ownership controls.

For application sign-in, verify the exact challenge with authoritative party/key
bindings, consume a browser-bound nonce atomically, validate origin/network and
issue a server-side authenticated session. See [authentication](authentication.md)
and the [runnable server reference](../examples/authentication-server/README.md).
A public key supplied by the same untrusted signing response is not, by itself,
authoritative proof of a Canton party's identity.

The explicitly configured legacy OAuth integration uses a dedicated registered
callback, S256 PKCE and single-use state. Browser client secrets are rejected.
Keep analytics and unrelated third-party scripts off authorization callback
pages. Vendor onboarding and endpoint contracts remain application configuration;
see the [Bron compatibility guide](../packages/adapters/bron/README.md).

Use least-privilege participant credentials on the server. Rebuild party and
interface filters from authenticated policy. Browser requests must not choose
an arbitrary participant URL, replacement credentials or another party's actAs.
A read permission, account provider role or visible contract does not establish
delegated signing authority.

Never automatically retry an uncertain ledger write. Correlate its original
application command and ledger update, then verify the operation's actual result.
Browser journals and UI records are recoverable hints, not an authoritative
financial-intent database. See [operation semantics](operation-kit.md).

Production registry signing is a separate maintained trust configuration. Code
support for signature verification does not make an unsigned registry signed.
Configure approved trust roots only as part of the documented signing rollout;
see [SIGNING.md](../SIGNING.md). Do not activate a mandatory verification policy
before its actual production signatures and trust roots are available.

## Dependency security evidence

The clean-consumer check audits the installed production dependency graph and
saves the complete report at `artifacts/packed-wallets/react-audit.json`.
The release gate rejects high and critical findings and retains moderate findings
in the report. A passing gate is not a claim that every dependency finding is zero
or that all affected paths are unreachable.

Review direct and transitive findings against their advisories and the real
installed versions. Re-test vendor contracts when upgrading wallet runtimes.
Do not use a forced audit downgrade that removes supported integrations, suppress
severities, or rely on workspace-only overrides as proof that published npm
consumers receive a patch.

Report security concerns through [SECURITY.md](../SECURITY.md).
