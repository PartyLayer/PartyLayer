---
"@partylayer/sdk": patch
---

Keep the internal hosted wallet profile behind a real package-private dynamic import in published ESM and CommonJS builds. Emit its private runtime/type targets separately, preserving discovery prewarming while removing its code from the initial connect surface. Validate private import targets in packed-package checks and attribute missing private maps to their owning package.
