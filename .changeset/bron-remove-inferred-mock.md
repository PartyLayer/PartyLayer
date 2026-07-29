---
"@partylayer/adapter-bron": minor
---

Remove Bron's URL- and environment-inferred mock behaviour. The API client no longer fabricates a session or a signature when the base URL contains `dev` or `mock`, and the adapter no longer swaps in a fake client based on `NODE_ENV` or a `useMockApi` flag. Bron now always uses the real API client and, when the OAuth callback is not wired by the app, fails loudly with a clear error instead of pretending in development. A mock, if wanted for a test, must be constructed explicitly by that test; it is never inferred from a URL or the environment. BREAKING: the `useMockApi` field is removed from `BronAdapterConfig`.
