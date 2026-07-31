---
"@partylayer/provider": patch
---

Widen the internal error code map to a Partial record so the new core SYNCHRONIZER_ERROR code compiles and falls through to the INTERNAL_ERROR default; no existing mapping changes.
