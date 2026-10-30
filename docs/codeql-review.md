# CodeQL review of the initial repository baseline

Review date: 2026-10-30. The first full default-branch scan reported 52 open
alerts after the newly introduced CI action pin was fixed. A PR-only scan does
not enumerate the entire default-branch baseline. Scanner severity alone does
not establish exploitability, and a successful workflow does not mean zero alerts.

## Changes made before the coordinated release

- Bound error-text matching and replace ambiguous trailing-zero/slash processing
  with linear scans. Add 100,000-character regression cases for core, React,
  React Native and Loop without changing ordinary inputs.
- Render QR SVGs in an image context rather than inserting SDK HTML into the DOM.
  Validate Console HTTPS hosts/paths and accept only WalletConnect pairing URIs
  on the display callback. Malicious SVG markup and active URI tests cover this.
- Rate-limit the optional Node registry server before file handlers; a real HTTP
  test proves excess requests receive 429 without reaching the handler.
- Constrain the disposable Expo server to loopback and its export directory;
  construct the clean-consumer fallback redirect under the fixed npm host.
- Read checked local files through one descriptor. Snapshot and recheck all
  approved tarballs in a private directory before the first npm staging write.
  A mutation-after-validation test asserts that no write is attempted.
- Pin third-party CI setup actions and declare read-only workflow defaults.
  Existing per-job issue reporting and owner-approved staging permissions remain
  explicit; no publishing rights are added.

## Individually reviewed false positives

The following baseline alerts are classified individually with a source-specific
explanation in GitHub. No query is disabled, path excluded or blanket allowlist
added to CodeQL. Re-evaluate these decisions if a use crosses a trust boundary.

| Alert IDs | Context and reason |
| --- | --- |
| 48–52 | Test-only message responders, including a deliberately forged-origin negative test. The production channel performs origin/source validation. Adding that guard to the attacker fixture would invalidate the test. |
| 47, 32 | Positive assertions about diagnostic text and attribution in generated templates; neither assertion validates an outbound URL or trusted host. |
| 45–46 | Intended release metadata requests to constant GitHub/npm origins, using public reviewed policy fields and encoded package names. Redirects are forbidden; these are not secret-file exfiltration requests. |
| 31 | Send error-text classification, not URL authorization. The help URL is a separate fixed value. |
| 29–30 | Client-local session correlation keys, never bearer credentials or authentication nonces. Backend proof, nonce consumption and server cookies establish authorization independently. Do not reuse these identifiers as credentials. |
| 26–28 | Synthetic IDs in the explicit mock wallet. They do not establish a real signature, transfer or ledger result. |
| 17–20 | Plaintext heading/document inspection. The transformed strings are never inserted into a DOM or treated as sanitized HTML. |
| 53 | The request Origin comparison implements CSRF checking. Proof verification, browser-bound nonce consumption and opaque server-session authorization are independent checks; choosing an Origin header does not grant access. |

## Scope

Validate the corrective changes with the full repository gate, new regression
cases, browser compatibility suite and a fresh CodeQL scan. Fixed baseline alerts
close when the scanner verifies the merged source; classification does not make
a vulnerable code path safe. The two documented Metro build-tool dependency
advisories, real wallet send/swap acceptance and an independent external audit
remain separate work. See [dependency maintenance](./dependency-maintenance.md)
and [wallet acceptance](./wallet-acceptance.md).
