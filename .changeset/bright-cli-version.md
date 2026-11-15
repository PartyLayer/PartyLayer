---
"@partylayer/conformance-runner": patch
"@partylayer/registry-cli": patch
---

Report the actual package version from `--version` instead of the stale `0.1.0` value. Inject the manifest version when building so installed CLI bins work independently of the current directory and module layout, and check the version on packed executables before release.
