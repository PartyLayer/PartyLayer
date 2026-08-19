---
"@partylayer/conformance-runner": patch
---

Fix the CLI, which could not start, and stop shipping source.

The build was two `tsc` passes that emitted ESM carrying extensionless relative specifiers, which Node cannot resolve, so `partylayer-conformance` failed immediately with `ERR_MODULE_NOT_FOUND: Cannot find module '.../dist/loader'`. The package now builds with tsup, which bundles the entry so no unresolvable relative import remains. It stays `type: module`, so the ESM output is still `dist/index.js` and the existing `bin` and `main` targets are unchanged.

It also had no `files` allowlist, so the tarball carried `src`, the vitest file, both tsconfigs and both tsbuildinfo files. Adding `files: ["dist"]` takes it from 34 files to 23.

Verified by installing the packed tarball in a project outside the repository and running `partylayer-conformance --help` from the installed package.
