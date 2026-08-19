---
"@partylayer/registry-cli": patch
---

Fix the CLI, which could not start, and stop shipping source.

Same defect as the conformance runner, from the same root cause: the `tsc` build emitted ESM with extensionless relative specifiers, so `partylayer-registry` failed at startup with `ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/registry'`. It now builds with tsup, which bundles the entry. The package stays `type: module`, so the ESM output remains `dist/index.js` and the existing `bin` and `main` targets are unchanged.

It also had no `files` allowlist, so the tarball carried `src`, `tsconfig.json` and `tsconfig.tsbuildinfo`. Adding `files: ["dist"]` takes it from 26 files to 6.

Verified by installing the packed tarball in a project outside the repository and running `partylayer-registry --help` from the installed package.
