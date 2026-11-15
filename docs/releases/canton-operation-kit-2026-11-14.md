# Canton operation-kit publication evidence

This historical checkpoint records the nineteen versions and `latest` tags
verified for the coordinated release. Subsequent Core, SDK, React Native and
conformance corrections are recorded in the
[2026-11-15 corrections](consumer-installation-corrections-2026-11-15.md).
The original SHA-512 bytes, registry signatures and Sigstore attestations were cryptographically
verified against the exact `PartyLayer/PartyLayer/.github/workflows/npm-publish.yml`
main-branch identity, GitHub issuer, source commit and run/attempt.
[Machine-readable proofs](canton-operation-kit-2026-11-14.json) record each producer.

Core belongs to [run 43617342925](https://github.com/PartyLayer/PartyLayer/actions/runs/43617342925).
The remaining eighteen belong to the separately owner-approved
[successful recovery run 43626767946](https://github.com/PartyLayer/PartyLayer/actions/runs/43626767946).
Core was excluded from recovery and was not republished. The recovery changed
bounded registry verification waits, corrected setup documentation and fixed
invalid provider requests before wallet/session/extension work.

| Package | Published version | Source |
| --- | --- | --- |
| `@partylayer/core` | `0.16.0` | `5b181ac` |
| `@partylayer/adapter-starter` | `0.1.23` | `a91b9ce` |
| `@partylayer/provider` | `0.6.2` | `a91b9ce` |
| `@partylayer/conformance-runner` | `0.2.12` | `a91b9ce` |
| `@partylayer/adapter-bron` | `0.7.0` | `a91b9ce` |
| `@partylayer/adapter-cantor8` | `0.5.3` | `a91b9ce` |
| `@partylayer/adapter-console` | `0.5.2` | `a91b9ce` |
| `@partylayer/adapter-loop` | `0.6.3` | `a91b9ce` |
| `@partylayer/adapter-nightly` | `0.3.3` | `a91b9ce` |
| `@partylayer/adapter-send` | `1.2.11` | `a91b9ce` |
| `@partylayer/adapter-walletconnect` | `0.5.2` | `a91b9ce` |
| `@partylayer/registry-client` | `0.7.2` | `a91b9ce` |
| `@partylayer/sdk` | `0.22.0` | `a91b9ce` |
| `@partylayer/session` | `1.1.11` | `a91b9ce` |
| `@partylayer/react` | `3.4.0` | `a91b9ce` |
| `@partylayer/vue` | `2.0.3` | `a91b9ce` |
| `create-partylayer-app` | `0.7.2` | `a91b9ce` |
| `@partylayer/react-native` | `1.0.5` | `a91b9ce` |
| `@partylayer/testing` | `1.1.12` | `a91b9ce` |

## Evidence and boundaries

The final source passed 2,148 package tests and 210 Chromium/Firefox/WebKit UI
cases, plus required build, regression and CodeQL workflows. Clean public npm
installation, ESM/CommonJS, SSR, authentication backend and CLI-generated React18
Vite/React19 Next production builds passed. Four foundation packages also passed
independent one-root installations, and wallet compatibility packages passed
public-export, runtime/fixture and strict consumer typing checks.

Installed-consumer testing identified follow-up corrections: CLI version output,
OneSwap's vendor peer range when core is declared directly, and a browser-only
dependency path in the React Native Metro graph. Corrective source work and
packed-consumer evidence are tracked separately; this publication record does
not certify those paths or erase the initial findings.

The clean React dependency audit reports 0 critical, 0 high and 23 moderate
package entries, corresponding to the previously recorded transitive advisories.
No severity filter or peer override was used to turn an invalid dependency tree
into a passing result. Network-interrupted installs were preserved and recovered
separately from product failures.

Production website beacon delivery was verified independently. Real funded wallet
transfers/swaps, physical devices, full spoken screen-reader flows and production
registry signing-key activation retain their separately recorded acceptance scope.
