---
"@partylayer/adapter-bron": minor
---

BREAKING: `BronAdapterConfig.api` no longer accepts (or requires) a `getAccessToken`.

The adapter always supplied its own access-token getter, wiring it to its OAuth
client, and ignored any `getAccessToken` passed in `config.api`. The type
nonetheless demanded one (`config.api` was typed as the internal `BronApiConfig`,
which the API client uses), so every caller had to pass a `getAccessToken` the
adapter discarded. `config.api` is now typed as the new `BronAdapterApiConfig`
(`{ baseUrl }`). A caller that passed `getAccessToken` gets a compile error and
should drop it; `baseUrl` is unchanged and there is no runtime behavior change.
