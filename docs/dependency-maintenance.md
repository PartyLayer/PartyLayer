# Dependency security and compatibility maintenance

Review date: 2026-10-30. Dependency reports, code review, live-wallet acceptance
and an independent audit are different evidence. A clean threshold check is not
a claim that every dependency or vendor deployment is vulnerability-free.

## Framework and consumer compatibility

The website, Studio and next SSR starter move from Next 14 to the patched
**Next 15.5.28** maintenance line, with **React 19.3.1**. Route parameters and
request cookies use the supported asynchronous APIs. The workspace apps resolve
one React Query instance so library and application providers share a context.
The Next starter labels a persisted identity as a display hint until the wallet
is revalidated; a cookie projection is not application authentication.

PartyLayer's React peer contract still supports React 18+. The normal single-command
consumer check exercises React 18 and the Next starter check exercises React 19;
both must install and build outside the workspace. No forced peer resolution,
legacy-peer-deps flag or new per-wallet package is used.

## Patched resolution policy

The private workspace's `pnpm.overrides` narrowly advances affected dependency
major lines to reviewed security fixes, including HTTP parsing, URL handling,
schema parsing, sanitization and build tooling. Overrides do not jump every
dependency to its latest major. They are reproducible in the frozen lockfile and
must pass the same builds, unit/security checks and browser acceptance as code.

**Workspace overrides are not inherited by downstream npm consumers.** Therefore
the packed-consumer gate separately installs the actual tarballs using ordinary
npm semver and the public third-party registry, without workspace/file overrides.
It audits that resulting production dependency graph and blocks high/critical
findings. The saved JSON retains moderate findings rather than hiding them.
Network failures, malformed audit output and unknown severities fail closed.

## Recorded audit scope

Before this maintenance, the workspace production-dependency audit reported
5 critical, 59 high, 64 moderate and 12 low findings. This graph includes installed
peers and tool dependencies; those counts do not establish exploitability of the
website or a wallet operation.

After the framework and compatible dependency fixes, the remaining workspace
findings are two high `image-size@1.2.1` parser advisories in the React Native
Metro build-tool path, and one moderate `uuid@9.0.1` advisory in an upstream
MetaMask/Canton dependency. The separate clean React consumer reports **zero
high and zero critical** findings. npm reports twenty propagated moderate package
entries for that UUID dependency chain; they are not twenty independent flaws.
Re-run the checks for the current registry state; new advisories can change this.

The Metro path currently uses image-size's v1 default export and file-path API.
Forcing v2 without migrating that call would break asset handling, so this change
does not conceal it with a blind major override. The UUID advisory concerns
buffered v3/v5/v6 calls; the inspected upstream filesystem helper uses v4. Neither
observation is a substitute for a fixed upstream release or a full reachability
audit. Track these remaining dependencies through reviewed vendor/tool updates.

## Continuous checks

- `pnpm gate:packed-wallets` audits the clean React consumer before exercising
  ESM, CommonJS, SSR, official defaults and generated application builds.
- The nightly public-consumer canary audits the installed, published package graph
  and saves the report; it does not rely only on the workspace's patched lockfile.
- CodeQL analyzes JavaScript/TypeScript and GitHub Actions on PRs, main and a weekly
  schedule, using pinned action commits and no package-publishing permission.
- Real PostgreSQL integration tests validate browser-bound nonce consumption,
  concurrent revocation and two HTTP replicas sharing sessions. These use generated
  test keys and do not certify a vendor wallet signing profile.

No audit suppression list, manual acceptance timestamp or wallet capability is
changed to make these checks pass. Production registry signing and live funded
wallet/protocol tests remain separate maintainer decisions. npm preparation and
promotion retain the owner-only workflow and final npm MFA approval.

See [security reporting](../SECURITY.md), [release process](./releasing.md),
[wallet acceptance](./wallet-acceptance.md) and
[GitHub CodeQL configuration](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning).
