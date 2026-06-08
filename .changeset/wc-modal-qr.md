---
"@partylayer/react": minor
"@partylayer/core": minor
"@partylayer/sdk": minor
"@partylayer/adapter-walletconnect": patch
---

WalletConnect / QR-only wallets now show a scannable QR **in the connect modal**
out of the box (no integrator wiring), with a mobile deep-link, and the official
dapp-sdk blank `about:blank` popup is suppressed.

- **core / sdk:** add an optional `onDisplayUri(uri)` callback to the adapter
  `connect()` options and to `ConnectOptions`. Adapters call it with a
  pairing/display URI (e.g. a WalletConnect `wc:` URI) the moment one is
  produced, before approval; the connect UI uses it to render a QR / deep-link.
  Backward-compatible (optional).
- **adapter-walletconnect:** the official adapter's `onUri` is now always
  wrapped so the pairing URI is fanned out to BOTH the integrator's
  `config.onUri` AND the per-connect `onDisplayUri` — no hand-wiring needed. The
  adapter also narrowly intercepts the official adapter's blank
  `window.open('', 'wallet-popup')` during connect (no config flag exists to
  disable it) and restores `window.open` afterward.
- **react:** the modal renders the WC QR itself. `handleWalletClick` passes
  `onDisplayUri` for non-dual (QR-only / remote-signer) wallets and enters the
  QR view only once a URI actually arrives (wallets that draw their own QR are
  unaffected). QR generated via `qrcode` (new dependency). Copy is
  wallet-agnostic for the generic WalletConnect entry ("Scan with your Canton
  wallet" / "Open wallet"). The dual-transport (Console) extension + placeholder
  QR-fallback flow is unchanged.
