---
"@partylayer/adapter-cantor8": minor
---

Rebuild the Cantor8 adapter on the wallet's own SDK, `@cantor8/wallet-connect-sdk` (0.4.0). The previous adapter (published at 0.2.20) was a non-functional `cantor8://` deep-link stub that threw "Cantor8 vendor not configured" on connect. It now drives the real popup + postMessage protocol: `connect` reads the party from `getAccounts()`, `submitTransaction` maps to `signAndExecute`, `disconnect` and transaction-status events (`txChanged`, surfaced via `on('txStatus')`) map to real SDK methods, and `detectInstalled` uses the wallet's own `c8#provider_discovery` event instead of a user-agent sniff that mislabeled this desktop popup wallet as mobile. The SDK supports devnet and mainnet only.

Cantor8 has no arbitrary-message signing, so `signMessage` now fails with `CapabilityNotSupportedError` rather than the stub's fabricated deep-link signature. It is not simulated, not routed through a transaction method, and does not silently succeed.

BREAKING for `@partylayer/adapter-cantor8`:
- Removed the `Cantor8VendorConfig` and `Cantor8VendorModule` types (the deep-link vendor abstraction).
- `Cantor8AdapterConfig` no longer has `vendorModule`, `vendorConfig`, or `useMockTransport`; it now has `dappUrl?` and `detectTimeoutMs?`.
- Removed `signTransaction` and `restore`; added `submitTransaction`, `on`, and the `Cantor8SubmitPayload` type.
- `signMessage` now rejects instead of returning a value.

A consumer upgrading who imported the removed vendor/deep-link types or called `signTransaction` will get a compile error; anyone who called `signMessage` will now get a clear capability error instead of a fake success. This is intended: the wallet has no message signing, and the previous stub could not connect at all.

The mapping and discovery are unit-tested against a mock of the SDK; a live connect/submit run requires the actual Cantor8 wallet. This change adds a runtime dependency on `@cantor8/wallet-connect-sdk` (zero-dependency, MIT), lazily imported to stay SSR-safe.
