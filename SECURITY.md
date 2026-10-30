# Security policy

Report suspected vulnerabilities privately to **security@partylayer.xyz**, the
security contact already published in the repository's security guides. If GitHub
offers **Report a vulnerability** for this repository, that private channel is
also suitable. Do not open a public issue containing an unpatched exploit.

Include the affected package/version, wallet and network, expected/observed
behavior, and a minimal reproduction with sensitive data removed. Never send
private keys, recovery phrases, passwords, authentication cookies or npm tokens.
Ordinary integration bugs can use the public issue templates.

## Scope and supported releases

Security maintenance targets the latest coordinated public release of the
affected PartyLayer package and the main branch. Report older-version issues too;
maintainers will determine whether an upgrade or backport is appropriate. Package
versions, registry channel, wallet version and participant API version can all
affect a reproduction.

The wallet remains responsible for its approval UI, keys and signing service.
The application remains responsible for backend authorization and business intent.
PartyLayer's maintained boundary includes discovery, session/identity guards,
request routing, honest transaction outcomes, registry handling and the shipped UI.
See [protocol ownership](docs/protocol-ownership.md) and the
[production checklist](docs/production-checklist.md).

## Review and disclosure

Maintainers triage the report, reproduce it, prepare a fix and appropriate tests,
and coordinate disclosure with affected parties before publishing exploit details.
Keep reports private until a patch or agreed disclosure plan is available. No
specific response-time commitment or external audit certification is implied.

Automated security/conformance tests and maintainer review are not an independent
security audit. Published audit reports, if commissioned, must identify their
reviewer, source revision, scope and unresolved findings.
