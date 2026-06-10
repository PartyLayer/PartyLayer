---
"@partylayer/adapter-send": patch
---

A2 incident fix: correct Send's extension-id data. Live diagnostics + Console
Wallet's own extension source proved `lpnfhpbpmlobjlgkdmnjieeihjmihhjd` is
**Console's** id, not Send's; it was wrongly held in `SEND_PRODUCTION_EXTENSION_ID`
/ `SEND_KNOWN_EXTENSION_IDS` / `SEND_BUILTIN_DETECTION`, so Console's announce
matched Send's accepted ids → a Send click could bind Console's channel and open
Console (the original swap). Send's id set is now its own id
(`ldmohiccoioolenadmogclhoklmanpgi`) only. Exported symbol NAMES are unchanged;
only the values are corrected (`SEND_LEGACY_EXTENSION_ID` is now a deprecated
alias of the production id).
