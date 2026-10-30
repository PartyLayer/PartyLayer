# Owner-approved npm releases

The selected release model uses **one protected GitHub approval per release run**.
`npm-publish.yml` builds and records exact package files, then waits for the owner
in the `npm-release` environment. After approval, an isolated job publishes those
files through npm OIDC. There is no separate npm approval for each package in this
model. The npm account retains 2FA; initial package/trust configuration can still
require separate npm verification.

**Activation status (2026-10-30):** the owner selected this model to replace repeated
per-package publication approvals. Its direct-publishing connections and first real
release must be verified before migration is recorded as complete. Nine reviewed
package versions are pending publication. Authenticated collaborator queries for
these nine packages identify only `cayvox` with read-write access; the core package
has no existing trust connection. Other packages' existing connections and token
restrictions still require inspection. This is not a completed migration claim for
all 20 packages.

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
7. Packages are published in dependency order. Public registry version, integrity
   and requested tag are checked after each write; short bounded retries apply
   only to registry propagation reads. Preserve the partial receipt. Verify
   provenance/signatures and a clean public installation before marking the full
   release complete and creating package-version tags at the source commit.

Keep the release window serial. A changed main/check/approval policy at preflight,
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

## Failure and recovery

A multi-package release is not atomic. All selected registry states and all file
snapshots are checked before the first write. The intent is saved before each write and each verified result updates
`publish-receipt.json`, uploaded even if the job stops. A failed
write or failed post-write check records `unknown-stop-and-inspect`; no write is
automatically retried. Inspect registry version/tag/integrity and provenance before
resuming. An identical published version is skipped only when its requested tag
also verifies; differing bytes or an unapproved retag are a hard stop.

## Verification

`pnpm gate:workflow-scripts` runs both legacy staging and direct-publisher tests.
They cover wrong actors/forks/refs/workflows/jobs, missing explicit publication,
missing OIDC, token/OTP fallback, changed main or CI, open code-scanning alerts,
extra reviewers, bypass/wildcard rules, source/hash drift, protected snapshots,
configuration isolation, publication order, read-only propagation retries and
partial-failure recovery. Tests use synthetic archives and fake writes: they
neither publish real versions nor constitute a real OIDC activation test.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[npm staged publishing](https://docs.npmjs.com/staged-publishing/) and
[GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
