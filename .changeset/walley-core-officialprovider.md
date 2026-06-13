---
'@partylayer/core': minor
---

Add the `OfficialProvider` interface and loosen `OfficialProviderAdapter.provider()`/`restore()` to return it (was `CIP0103Provider`). The official `@canton-network` `Provider<RpcTypes>` types `request` as generic over its own method literals, which is not structurally assignable to the string-method `CIP0103Provider.request` — so the stricter type prevented passing a real official adapter (e.g. `new WalleyAdapter()`) without a cast. `OfficialProvider` is loose enough that a real official adapter satisfies it; the bridge treats it as a `CIP0103Provider` at the call site (it only ever calls `request({ method, params })`).
