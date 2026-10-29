# Owner-approved npm releases

The release workflow prepares verified packages and can submit them to **npm staging**. It never approves a stage or publishes directly. A staged package becomes public only after the owner's separate npm 2FA approval.

**Activation status (2026-10-29):** the workflow is merged and the first owner-approved OIDC release, `create-partylayer-app@0.7.0`, is public. The dedicated GitHub `npm-release` environment has `anilkaracay` as its sole reviewer, no administrator bypass and only the `main` branch. Authenticated collaborator queries found only `cayvox` with read-write access on all 20 packages. The CLI's stage-only npm connection and real release are verified; npm also accepted its require-2FA/disallow-tokens setting. Other packages' existing trust connections and token restrictions remain unaudited, so this is not a claim of completed migration for all 20 packages.

## Owner and trust boundaries

| Boundary | Required identity or setting |
| --- | --- |
| GitHub repository | `PartyLayer/PartyLayer`, immutable repository ID `1142218754` |
| Initial dispatch | GitHub account `anilkaracay`, immutable user ID `70052819` |
| Rerun and release-environment reviewer | `anilkaracay` only |
| npm maintainer and final approver | Owner's npm account `cayvox` |
| Workflow | `.github/workflows/npm-stage.yml` |
| GitHub environment | `npm-release`; `main` branch only; administrator bypass disabled |
| npm trusted-publisher actions | Stage only; direct publish and independent dist-tag management disabled |
| npm publishing access after migration | Require 2FA and disallow traditional tokens |

The owner confirmed that both GitHub administrator accounts (`anilkaracay` and `cayvox`) belong to them. The release workflow deliberately uses `anilkaracay`; it does not remove the owner's second administrator/recovery account. Self-review is allowed for this single reviewer so an owner-initiated release can proceed. That GitHub approval permits staging only; npm still requires a separate interactive 2FA approval for publication.

The reviewed identities, toolchain and frozen list of 20 existing packages live in [the release policy](../.github/npm-release-policy.json). A new package, renamed account or changed publishing path requires a reviewed policy change. Both public maintainer metadata and authenticated effective collaborator queries currently identify only `cayvox` for all 20 packages. That does not establish the absence of other trusted-publisher connections or complete the token-restriction audit.

## First verified release

[`create-partylayer-app@0.7.0`](https://www.npmjs.com/package/create-partylayer-app/v/0.7.0) was prepared and staged by [workflow run 40896650344](https://github.com/PartyLayer/PartyLayer/actions/runs/40896650344), from commit `3356c383cee44f10c5a2f4f5515e938e423c92f9`. The owner explicitly approved that run's GitHub environment gate and completed npm's separate final 2FA approval. No manually created npm publishing token was used by the workflow.

The downloaded staged and public tarballs matched the prepared artifact byte for byte. The `latest` tag, Node `>=20.12.0` engine, registry signatures and provenance were checked; provenance names this workflow, source commit and run. A clean unauthenticated npm consumer installed CLI 0.7.0, generated a React/Vite application, passed Doctor and completed its production build. `npm audit signatures` verified the installed consumer's registry signatures and attestations. These checks establish the release path, not live wallet or ledger acceptance.

The CLI connection grants only `createStagedPackage`, bound to `PartyLayer/PartyLayer`, `npm-stage.yml` and `npm-release`. npm acknowledged `npm access set mfa=publish create-partylayer-app`; an independent settings read-back remains to be recorded. Before activating each of the remaining 19 packages, audit existing trust connections and token settings and complete its next real release through the same owner-approved path. Do not pre-create unused connections and let their initial-validation window expire.

## Prepare and stage a release

1. Merge a normal version/release PR with changelogs, coordinated dependency versions and current template pins. Wait for **both** the CI and regression-gate push runs to pass on the current `main` commit.
2. Open **Actions → Owner-approved npm staging → Run workflow** as `anilkaracay`. Select `main`, explicitly name the existing packages separated by commas, and select `latest` or `next`. Leave **stage** unchecked for the first preparation-only run. No PR event or tag push triggers a release.
3. Preparation checks the actor, immutable repository identity, current source SHA, exact CI runs and actual environment approval/branch rules. It builds the workspace, runs publish/packed-consumer gates, packs with pinned pnpm and records a SHA-512 integrity manifest. The job has no npm token or OIDC publishing permission.
4. Inspect the `npm-release-<sha>-<attempt>` artifact, including selected names, versions, dist-tag and checksums. Preparation refuses a downgrade of `latest`, unpublished omitted internal dependencies, unknown packages and an existing version with different bytes.
5. When npm trust settings have been verified, dispatch with **stage** checked. The isolated staging job waits for the owner's GitHub environment approval. It downloads only this run's artifact, checks source/run identity, selection, tag, package manifests, README/license, file paths and hashes, and rechecks CI, environment rules and current registry state.
6. The job uses `npm stage publish` on the exact validated tarballs. It installs no application dependencies, executes no package lifecycle hooks and runs npm from an empty temporary directory rather than loading the repository's npm configuration. There is no `npm publish`, `npm stage approve`, `npm stage reject` or token fallback in the workflow.
7. Preserve the stage receipt. Sign in to npm as `cayvox`, inspect the staged package, download and compare its tarball integrity with the prepared manifest, then approve with 2FA. Approve coordinated dependencies in the recorded dependency order. The automation does not ask for or handle the owner's 2FA code.
8. Verify public registry integrity, provenance, dist-tags and a clean public-consumer installation. Only then mark the release complete and create its package-version tag at the reviewed source commit.

Keep the release window serial. A new commit on `main`, changed `latest`, missing CI result or changed approval rule stops the workflow; dispatch again from the new reviewed state rather than bypassing it. A preparation-only run validates packaging, not npm OIDC, stage creation, 2FA promotion or final provenance.

## Activate npm trust without widening publishing rights

Use a GitHub-hosted runner, **Node 24.21.0**, **npm 11.19.0** and **pnpm 9.15.9**, pinned in the workflow. Staged publishing requires npm 11.15.0+ and Node 22.14.0+; the ordinary Node 20 CI jobs do not establish this publishing capability. These are release-tool requirements, separate from application/package runtime engines.

For each package being activated, use its authenticated npm settings to bind the trusted publisher to:

- Organization `PartyLayer`, repository `PartyLayer` and workflow filename `npm-stage.yml`.
- Environment **`npm-release`**, not a website's Vercel environment.
- Stage-only permission. Leave direct publishing and separate dist-tag management disabled.

Audit every other trust connection and effective organization/team publishing grant. Do not silently replace or delete account access. Package-setting and trust changes require the owner's authenticated interaction and may require 2FA. Do not put an npm write token in repository/environment secrets or workflow variables.

Complete and verify the first real owner-approved release before relying on the new path. Newly created npm trust connections expire if their initial validation is not completed within the period described in [npm's current documentation](https://docs.npmjs.com/trusted-publishers/); configure them when the owner is ready for that release. Then select **Require two-factor authentication and disallow tokens**, verify that stage-only OIDC still works, and revoke superseded automation tokens. Preserve the owner's recovery access.

Use the verified staged workflow for CLI releases. The [release process](./releasing.md) also describes versioning and validation; it is not authorization to bypass the owner gate or introduce publishing tokens for packages still awaiting migration.

## Failure and recovery

A monorepo release is not atomic. The script checks all selected registry states before staging the first package and records each successful stage immediately. It stops on the first failure and preserves the partial receipt. It does not retry a possibly successful write, reject an unknown stage, overwrite a version or unpublish a package.

OIDC credentials cannot inspect or approve existing stages. If a stage request times out or its result is uncertain, use the owner's interactive npm account to inspect/download it and compare bytes before retrying. If an identical version is already public it can be skipped; a differing integrity is a hard stop. Never interpret a mocked staging test as a successful real registry release.

## Verification

`pnpm gate:workflow-scripts` runs the workflow/script tests as part of the mandatory repository gate. They exercise wrong actors/forks/refs, changed main, failed or stale CI, missing approval, extra reviewers, administrator bypass, wildcard branches, archive/source/hash drift, owner-selection changes, token fallback, dependency ordering and partial-failure recovery. Tests use local archives and fake APIs/commands; they do not create npm stages or approve a release.

See [npm staged publishing](https://docs.npmjs.com/staged-publishing/), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/) and [GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) for the service contracts.
