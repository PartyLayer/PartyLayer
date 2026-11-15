# Owner-approved npm releases

The selected release model uses **one protected GitHub approval per release run**.
`npm-publish.yml` builds and records exact package files, then waits for the owner
in the `npm-release` environment. After approval, an isolated job publishes those
files through npm OIDC. There is no separate npm approval for each package in this
model. The npm account retains 2FA; initial package/trust configuration can still
require separate npm verification.

**Earlier activation (2026-10-30):** all nine selected versions are public with the
reviewed SHA-512 integrity and `latest` tag. Their exact direct-publishing
connections were verified; authenticated collaborator queries identify only
`cayvox` with read-write access. The owner approved each specific release run.
Core was published by the first run; the remaining eight were published by the
successful recovery run after adding bounded asynchronous-processing waits.
Clean public consumer checks passed. npm accepted the **require 2FA and disallow
traditional tokens** setting for all eight non-CLI packages; the CLI setting had
already been accepted during its earlier release. These observations are successful
authenticated setting responses, not a separate settings-page read-back audit.
That checkpoint covered nine packages only; the following coordinated release
extends publication evidence, with separate package-security activation status.

## Coordinated operation-kit release

Nineteen existing package versions are public with verified SHA-512 bytes, latest
tags, registry signatures and GitHub workflow/source provenance. Core 0.16.0 was
published by [run 43617342925](https://github.com/PartyLayer/PartyLayer/actions/runs/43617342925)
from `5b181acd520e2e26e28f018d1910451e3f699689`. The owner separately approved the
remaining eighteen files in [run 43626767946](https://github.com/PartyLayer/PartyLayer/actions/runs/43626767946),
which completed from `a91b9ce1089b661c5e48d6a7d1e587e4254761f1`.
See [per-package release evidence](releases/canton-operation-kit-2026-11-14.md).

The ten additional connections accepted during setup are now proven by actual
OIDC publication. On 2026-11-15, npm accepted `mfa=publish` for each of those ten
packages: Bron, Console, Send, Nightly, adapter-starter, conformance-runner,
provider, session, testing and Vue. Together with the earlier nine-package record,
all nineteen have accepted require-2FA/disallow-traditional-token settings. These
are authenticated setting responses, not an additional settings-page audit.

Registry CLI is the twentieth existing package. npm accepted its exact
`PartyLayer/PartyLayer → npm-publish.yml → npm-release` publish connection
(`bbd0ab3d-5251-4f46-83c2-19323fac1932`). Its first actual OIDC publication,
version 0.1.15, was cryptographically verified from owner-approved
[run 43700649247](https://github.com/PartyLayer/PartyLayer/actions/runs/43700649247).
The owner then completed npm's web MFA and npm accepted its `mfa=publish` setting
on 2026-11-15. All twenty existing packages now have actual OIDC publication
evidence and accepted traditional-token restrictions. See the
[five-package correction evidence](releases/consumer-installation-corrections-2026-11-15.md).
Setting responses remain distinct from a separate settings-page read-back audit.

## Owner and trust boundaries

| Boundary | Required identity or setting |
| --- | --- |
| GitHub repository | `PartyLayer/PartyLayer`, immutable repository ID `1142218754` |
| Dispatch, rerun and environment approval | `anilkaracay`, immutable user ID `70052819` |
| npm maintainer and initial settings | Owner's npm account `cayvox` |
| Direct-publishing workflow | `.github/workflows/npm-publish.yml` |
| GitHub environment | `npm-release`; only `main`, one owner reviewer, no administrator bypass |
| npm connection | Exact repository, workflow filename and environment; allow publication; separate dist-tag management disabled |
| Account/package settings | Preserve 2FA and restrict traditional publishing tokens |

Both GitHub administrator accounts, `anilkaracay` and `cayvox`, belong to the owner.
The workflow intentionally uses `anilkaracay`; it does not remove the second
administrator/recovery account. Self-review is allowed so the single owner can
approve their own dispatch. Public repository visibility does not grant release
approval or npm rights. This model removes the independent npm publication MFA
barrier; the protected GitHub approval is the publication decision.

Identities, toolchain and the fixed list of 20 existing packages are recorded in
[the release policy](../.github/npm-release-policy.json). A new package, workflow,
identity or trust boundary requires a reviewed change. Sole maintainer metadata
alone does not prove that no other trusted-publisher connection exists.

## Prepare and publish a release

1. Merge the ordinary version PR. CI, the regression gate, browser compatibility
   and CodeQL must all pass on the exact current `main` commit. Review any open
   default-branch code-scanning alerts; publication refuses an unreviewed baseline.
2. As `anilkaracay`, dispatch **Owner-approved npm publishing** on `main`, name
   the existing packages explicitly, and select `latest` or `next`. The **publish**
   input defaults to false, which prepares files without any npm write. When the
   package connections are ready, select **publish** to prepare and request the
   owner's environment approval in the same run.
3. Preparation verifies identities, current main, checks and actual environment
   protection. It builds, validates packed consumers, packs through pinned pnpm
   and uploads `npm-release-<sha>-<attempt>`, containing the SHA-512 manifest and
   exact files. Preparation has no OIDC publishing permission.
4. Review names, versions, dependency order, tag and integrity in that run's
   artifact. Approve **that specific run** in `npm-release`. A dispatch or an
   earlier preparation approval is not blanket permission for later releases.
5. The separate publishing job uses a fresh runner, pinned Node/npm and no
   application dependencies. It revalidates source/run/attempt, owner selection,
   source manifests, archive paths, README/license, hashes, successful checks,
   code-scanning status, registry state and environment rules. It also verifies
   the exact publishing workflow reference and protected job name.
6. Every archive is copied into a private snapshot before the first write. Empty
   user/global npm configurations replace inherited configuration. The job uses
   `npm publish <exact-file> --ignore-scripts --provenance` through OIDC. It does
   not repack source, execute package hooks, use a persistent npm token or OTP,
   manage dist-tags separately, overwrite versions or unpublish packages.
7. Selected packages are grouped into dependency waves using runtime, optional
   and peer dependencies, including dependencies inside shipped CLI starter
   manifests. Every selected dependency must be publicly verified in an earlier
   wave; a CLI release cannot precede the SDK required by its generated applications.
   Within a wave, npm writes remain strictly serial and single-attempt. After those
   writes are accepted, only their read-only public version/integrity/tag checks
   run concurrently. The next wave cannot write until every check succeeds.
   npm can accept a publication before its asynchronous processing finishes.
   Each package's read-only window remains bounded to twenty minutes, with the
   existing five-second polling and eight-second HTTP request limits, within the
   six-hour job limit. Independent packages can process during the same window;
   this does not guarantee npm processing speed. Integrity mismatches end that
   package's verification immediately and block the next wave; the other accepted
   writes' read-only checks are allowed to settle and save their evidence.
   A write exception stops every subsequent write, including the rest of its wave.
   Only earlier accepted writes are then verified; the uncertain write is never
   automatically repeated. Preserve the partial receipt and inspect the registry
   before recovery: npm may finish processing after a local deadline. Verify
   provenance/signatures and a clean public installation before marking the full
   release complete and creating package-version tags at the source commit.

Keep the release window serial across workflow runs. A changed main/check/approval policy at preflight,
changed registry latest, mismatched file or unknown outcome stops the operation.
A preparation-only success proves packaging, not publication, npm trust activation
or final provenance. Never approve an unrelated run to work around a failed gate.

## Activate the package connections

Use a GitHub-hosted runner with pinned **Node 24.21.0**, **npm 11.19.0** and
**pnpm 9.15.9**. These release-tool versions are separate from package runtime
engines. Configure each selected package's connection for:

- Repository **PartyLayer/PartyLayer**.
- Workflow filename **npm-publish.yml**, without a directory prefix.
- Environment **npm-release**.
- Direct publishing permission; leave independent dist-tag management disabled.

Audit existing connections and effective collaborator/team grants before adding
a connection. Do not silently delete account access. Initial configuration and
package-security changes may require MFA for each package: one GitHub approval
per release does not promise one verification for the initial migration.

A new connection must complete its first successful publish within npm's validation
window (currently two days). Configure it for an imminent, reviewed release.
After the first real release works, select **Require two-factor authentication and
disallow tokens**, verify the setting and revoke superseded automation tokens.
Trusted OIDC publication remains supported with that setting; owner recovery
access and ordinary account 2FA are retained. Never add an npm publishing token to
repository or environment secrets as a fallback.

## Existing staged workflow and first verified release

`npm-stage.yml` remains available for packages that intentionally retain two
independent approvals. It grants only staging, with a separate npm MFA approval
for publication. Keep its existing connections stage-only; do not widen them to
activate the new direct-publishing workflow.

The historical first verified tokenless release was
[`create-partylayer-app@0.7.0`](https://www.npmjs.com/package/create-partylayer-app/v/0.7.0),
from [run 40896650344](https://github.com/PartyLayer/PartyLayer/actions/runs/40896650344)
and source `3356c383cee44f10c5a2f4f5515e938e423c92f9`. The owner approved the GitHub
stage and separately completed npm MFA. Staged/public/prepared tarballs matched;
registry provenance, signatures, latest, clean installation, Doctor and a generated
Vite build were checked. Its stage-only connection and token restriction were
accepted by npm; an independent settings read-back remains to be recorded.
Those observations validate the old path, not the new direct publisher or live
wallet send/swap acceptance.

## First direct release

The owner approved [run 41033004742](https://github.com/PartyLayer/PartyLayer/actions/runs/41033004742)
for nine packages. npm accepted core, but asynchronous processing outlasted the
old six-second metadata check. The job stopped before any other write. Core's
public bytes, tag, registry signature and provenance were checked before recovery;
it was excluded from the next dispatch and was never resent.

After the bounded read-only wait was fixed and all four required workflows passed
on the new main commit, the owner separately approved
[run 41039254435](https://github.com/PartyLayer/PartyLayer/actions/runs/41039254435).
That run successfully published the remaining eight reviewed versions:

| Package | Version | Source commit |
| --- | --- | --- |
| `@partylayer/core` | `0.15.1` | `8d0417b0812f9c75530802aa3b98fee899c2522c` |
| `@partylayer/adapter-loop` | `0.6.2` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `@partylayer/registry-client` | `0.7.1` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `@partylayer/adapter-cantor8` | `0.5.2` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `@partylayer/adapter-walletconnect` | `0.5.1` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `@partylayer/sdk` | `0.21.0` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `@partylayer/react` | `3.2.0` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `@partylayer/react-native` | `1.0.4` | `4c12b933860baaf670110120511ae617f94eed0f` |
| `create-partylayer-app` | `0.7.1` | `4c12b933860baaf670110120511ae617f94eed0f` |

The recovery files were checked against the first reviewed files: compiled code
and dependency values were identical. Only JSON key ordering changed in the SDK
and React package manifests; the recovery manifest records their actual hashes.
Publication receipts and npm provenance identify the actual source/run for each
version, rather than attributing the whole release to one commit.

For all nine versions, public registry signatures and Sigstore attestations were
verified with npm 11.19.0's verification implementation. Downloaded tarball SHA-512,
provenance subject, workflow, source commit and invocation matched the reviewed
records. Clean installations from the public npm registry passed the single-command
React contract, ESM/CommonJS imports, SSR initialization, official wallet defaults,
server authentication and lossless amount checks. The public CLI generated both
Vite and Next.js applications; both installed and built successfully without
workspace links or a local registry. The React consumer audit reported no high or
critical findings and 20 propagated moderate entries; see
[dependency maintenance](./dependency-maintenance.md) for the remaining upstream
dependency limitations.

This records npm publication, not funded wallet send/swap acceptance, physical
mobile testing, a completed VoiceOver session or an independent security audit.

## Failure and recovery

A multi-package release is not atomic. All selected registry states and all file
snapshots are checked before the first write. `publish-receipt.json`, uploaded even
if the job stops, records each package's progress:

- `unknown-stop-and-inspect`: intent persisted before its single write. A write
  that throws or is interrupted retains this uncertain state.
- `publish-accepted-awaiting-verification`: npm returned success, but public
  version, integrity and requested tag have not all been verified yet.
- `published-verified`: the accepted write's public checks succeeded.
- `publish-accepted-unverified`: npm accepted the write, but its public check
  failed or timed out. This does not prove publication failed.
- `already-published-identical`: existing bytes and the requested tag were checked
  before publication; the package was skipped without a write or retag.

After a write or verification failure, the job settles the bounded read-only
checks for accepted writes, saves their individual outcomes, and stops. It does
not retry writes or start a later wave. Inspect registry version/tag/integrity and
provenance before resuming. Differing bytes or an unapproved retag are a hard stop.

## Verification

`pnpm gate:workflow-scripts` runs both legacy staging and direct-publisher tests.
They cover wrong actors/forks/refs/workflows/jobs, missing explicit publication,
missing OIDC, token/OTP fallback, changed main or CI, open code-scanning alerts,
extra reviewers, bypass/wildcard rules, source/hash drift, protected snapshots,
configuration isolation, dependency/template/optional-peer wave barriers, serial
single writes, concurrent read-only checks, bounded propagation retries and
partial-failure recovery after all accepted checks settle. Tests use synthetic archives and fake writes: they
neither publish real versions nor constitute a real OIDC activation test.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[npm staged publishing](https://docs.npmjs.com/staged-publishing/) and
[GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
