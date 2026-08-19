---
"@partylayer/conformance-runner": patch
---

Ship only `dist`. The package had no `files` allowlist, so the published tarball carried `src`, the vitest test file, both tsconfigs and both tsbuildinfo files alongside the build output. The tarball goes from 34 files to 23, with no change to what is importable or runnable.
