# Website audience measurement

The marketing/docs site uses Cloudflare Web Analytics' manual JavaScript beacon.
Its public site id is kept in `apps/demo/src/lib/site-analytics.ts`; it is not a
Cloudflare API token and grants no account management or publishing permission.
No Cloudflare login cookie, API key, npm token or private signing key belongs in
the public repository.

The beacon loads after hydration, only for production builds on `partylayer.xyz`
and `www.partylayer.xyz`. Local development, preview deployments, lookalike
hostnames and `registry.partylayer.xyz` are excluded. Cloudflare's SPA measurement
handles in-site navigation; the application does not send a second manual page
event. The script adds no wallet identity, party id, signature, balance or custom
SDK event payload.

This is a website-only integration. Installing PartyLayer in another application
does not enable this measurement. Optional SDK telemetry retains its existing
explicit application configuration.

## Read the right metric

| Measurement | What it establishes |
| --- | --- |
| Cloudflare Web Analytics visits/page views | Browser-measured website activity and page performance |
| Proxied registry HTTP requests | Catalog/discovery service usage, including automation and retries |
| Search Console clicks/impressions | Google search visibility and search-driven visits |
| npm downloads | Package retrieval, including CI, bots, caches and repeat installs |
| Verified application integrations | Independently evidenced adoption by an application |

Do not add these numbers together or call all of them unique developers.
JavaScript blocking, ad blockers and bot classification affect Web Analytics.
Use Cloudflare's **Exclude Bots** dimension when assessing audience growth; it is
a closer estimate of human visits, not proof that every remaining visitor is a
person. A website traffic increase alone does not demonstrate an npm download or
wallet integration increase, or prove which change caused the increase.

With a local production server running, verify the built integration without
generating production analytics visits:

```sh
node scripts/verify/website-analytics.mjs http://127.0.0.1:3197
```

The smoke routes both production hostnames to the local server, substitutes an
inert beacon, checks SPA script deduplication, rejects a lookalike hostname and
local collection, and requires the fixture preview to return 404. It never
executes the real beacon or sends traffic to the metrics endpoint.

After the reviewed website deployment, verify one real production visit and the
site's report in the maintainer's Cloudflare account. Historical traffic before
activation is not reconstructed by adding the script. Keep the original proxied
registry analytics as a separate operational signal.

## Official references

- [Manual setup for sites not proxied by Cloudflare](https://developers.cloudflare.com/web-analytics/get-started/#sites-not-proxied-through-cloudflare)
- [Automatic SPA measurement](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)
- [Dimensions, including Exclude Bots](https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/)
