# Consumer installation corrections: publication evidence

The five versions below were published as `latest` on 2026-11-15 by the
owner-approved [run 43700649247](https://github.com/PartyLayer/PartyLayer/actions/runs/43700649247),
attempt 1, from source `c606e8350acf34d096226eb685b9f89f1382bdf7`.
Both preparation and publication completed successfully. Actual public tarball
bytes, latest tags, registry signatures and Sigstore provenance were verified
against that exact source, run and `npm-publish.yml` main-branch identity.
See the [machine-readable evidence](consumer-installation-corrections-2026-11-15.json).

| Package | Published version | Correction |
| --- | --- | --- |
| `@partylayer/core` | `0.16.1` | Cryptographic session identifiers; optional secure native entropy hook |
| `@partylayer/sdk` | `0.22.1` | Fail-closed session crypto, compatible OneSwap dependency tree and a genuine private lazy profile |
| `@partylayer/react-native` | `2.0.0` | Native-only production dependencies, AsyncStorage 2.x and explicit browser SDK setup |
| `@partylayer/conformance-runner` | `0.2.13` | Correct installed CLI version output |
| `@partylayer/registry-cli` | `0.1.15` | Correct installed CLI version output |

The existing web connection design and browser SDK contract are retained. No new
wallet package was published. React Native 2.0 is a major release because the
browser SDK is no longer a transitive native dependency and constructor identity
is explicit. Native applications use the native package; web applications install
the existing SDK alongside it. Follow the
[native migration guide](../../packages/react-native/README.md#migrating-to-20).

## Reviewed source and files

The source passed 2,277 workspace tests, 210 Chromium/Firefox/WebKit UI cases,
all required main-branch CI/regression/CodeQL workflows, 20 packed-package checks
and 46 compiled documentation examples. All six size budgets passed unchanged.
The five downloaded GitHub archives passed independent SHA-512, source/run,
manifest, conditional-routing, README and license checks. Their 56 compiled
JavaScript/declaration files were byte-identical to the locally tested files.

Real packed Vite and Next.js builds verified the private hosted-profile dynamic
boundary. Packed native consumers passed strict dependency/type checks, three
actual Metro bundles and native Jest checks. The
[earlier nineteen-package release](canton-operation-kit-2026-11-14.md) remains a
separate historical record; these corrections preserve its initial findings.

## Public consumer verification

Fresh public-npm consumers passed after publication. Each used new installation
directories and empty npm user/global configuration, preserved `HOME`, preferred
online metadata and matched the approved version/integrity before and after
installation. Public tarball cache reuse was recorded. No workspace/file
dependencies, peer overrides, aliases, global shims or `legacy-peer-deps` were
used to produce passing results.

- Core, SDK and both CLIs passed standalone installations and strict dependency
  trees. Each tree resolved exactly one Core 0.16.1. Core/SDK ESM and CommonJS,
  secure entropy and AES rejection/cache cases, public declarations, malformed
  request boundaries, default SSR discovery and declared CLI contracts passed.
- The ordinary `npm install @partylayer/react @tanstack/react-query` command
  installed React 3.4.0 with SDK 0.22.1 and one Core 0.16.1. ESM/CommonJS,
  SSR/default wallets, operations and the fourteen-language catalog passed.
  Public CLI 0.7.2 generated React 18 Vite and React 19 Next.js applications;
  both actual production builds and dependency checks passed.
- The native-only public installation passed with Core 0.16.1, React Native
  2.0.0 and AsyncStorage 2.2.0, without the browser SDK/vendor graph. Strict
  declarations (`skipLibCheck: false`), three actual Metro bundles and four
  native Jest tests passed. This does not certify a physical device or wallet.

The unfiltered React consumer audit reports **0 critical, 0 high and 23 moderate**
package entries from three transitive advisory sources:
[glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) and
[uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
Those counts are unchanged from the prior public-consumer checkpoint; this
correction is not a claim that the complete dependency graph has zero advisories.

## Publishing security and acceptance boundaries

Registry CLI's first actual OIDC publication is proven by this run. npm then
accepted its owner-authenticated `mfa=publish` setting. Together with the earlier
nineteen settings, all twenty existing packages have accepted require-2FA and
disallow-traditional-token settings. These are successful authenticated setting
responses, not a separate settings-page read-back audit. The protected GitHub
environment retains one owner reviewer, only `main`, and no administrator bypass.

Funded wallet transfers/swaps, physical-device checks, full spoken screen-reader
acceptance and production registry signing-key activation retain their separately
scheduled scope. Message signing or a passing transport fixture does not certify
ledger settlement.
