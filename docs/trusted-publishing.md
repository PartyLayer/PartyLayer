# Tokenless publishing: activation plan

Status: design prepared; no trusted publisher or publishing workflow is enabled
by this document. Continue using the authenticated [release process](./releasing.md)
until the replacement has passed its dry run and account configuration review.

## Goal and current constraint

Publish reviewed releases from GitHub Actions with short-lived npm OIDC
credentials and verifiable provenance instead of sharing npm write tokens.
npm's [trusted-publisher documentation](https://docs.npmjs.com/trusted-publishers/)
currently requires npm CLI 11.5.1+ and Node 22.14.0+ on a supported hosted runner.
Use a pinned, supported toolchain in the eventual workflow; the existing Node 20
test jobs do not establish OIDC publishing support.

This repository pins pnpm 9.15.9. Its `pnpm release` path lets pnpm rewrite
`workspace:*` and `workspace:^` ranges before publishing. Do not replace this
with `npm publish` against raw workspace directories. A tokenless migration must
preserve that manifest transformation; npm CLI OIDC support alone is not proof
that our current pnpm publishing path supports it.

## Reviewable implementation sequence

1. Keep package versioning in a release PR targeting `main`, with changelogs and
   coordinated template pins. Require the normal CI and regression gate on its
   exact head. Build and package the merged release commit, not a floating branch
   or an artifact supplied by an untrusted pull request.
2. Add a manually dispatched workflow, restricted to the default branch, with
   read-only repository permission by default. Packaging and validation need no
   npm publishing credentials. Pack with the pinned pnpm version so workspace
   dependencies become real semver ranges.
3. Before enabling publication, validate the resulting tarballs: manifest names
   and versions match the reviewed release; no workspace ranges remain; all
   entrypoints, README and license exist; clean ESM/CommonJS consumers and
   generated starter builds pass. Preserve tarball checksums and the source SHA
   as the release record. Reuse the repository's packed-consumer gates.
4. Use an isolated publishing job with `id-token: write`, a GitHub-hosted runner
   and the supported npm CLI. Publish the validated pnpm tarballs in dependency
   order. Never rebuild or edit a tarball after recording its checksum. Test the
   exact npm-tarball/OIDC path before treating it as the standard release route.
5. On npm, configure each package's trusted publisher for organization
   `PartyLayer`, repository `PartyLayer`, the actual reviewed workflow filename
   and an explicitly chosen GitHub release environment. Configure that
   environment's approval rules before relying on it for protection. These
   account permissions need maintainer review; creating a workflow alone does
   not configure them.
6. Verify public registry metadata, integrity and provenance after the first
   release. Reinstall the published entrypoints in a clean consumer and run the
   documented quick start. Remove any superseded automation token only after
   the replacement is verified. Do not remove a maintainer's recovery access.

## Failure and recovery

npm releases are not atomic across a monorepo. Record each successful package
and stop when a publish fails. Before a retry, compare existing registry
integrity with the prepared artifact and skip only an identical published
version. A version already present with different contents is a hard stop,
not permission to overwrite, unpublish or silently accept it. Preserve existing
dist-tags unless the release explicitly calls for changing them.

README fixes also need publication: merging a corrected source README does not
change the README shown for an already published npm version. Track these with
changesets even when the runtime bundle is unchanged.
