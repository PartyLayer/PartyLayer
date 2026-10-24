# PartyLayer website and demo

The Next.js app behind `partylayer.xyz`: product pages, developer documentation,
wallet directory and interactive kit demo. This is a workspace development guide;
application developers should start with the [public quick start](https://partylayer.xyz/docs/quick-start).

## Run locally

From the repository root, using its pinned pnpm version:

```bash
pnpm install
pnpm build
pnpm --filter partylayer-demo dev
```

Open `http://localhost:3000`. Set `PORT=3187` before the final command if port 3000
is in use. Do not run multiple Next dev/build processes against the same `.next` directory.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Product overview, installation and live connection tools |
| `/docs` | Developer documentation |
| `/docs/quick-start` | One-command React installation and complete Vite/Next.js setup |
| `/wallets` | Registry-backed wallet directory |
| `/kit-demo` | Themes, English/Turkish and RTL, wallet discovery and connection tools |
| `/cost-demo` | Cost-related UI examples |
| `/debug` | Registry and event diagnostics |

The homepage and kit demo explicitly use **Devnet beta** and a same-origin registry
at `/registry`. Send is absent because its catalog entry supports Mainnet only.
Vala's beta listing is not proof of live transaction acceptance. Use an independent
app with an explicit network to test another supported environment.

## Registry and wallet configuration

`predev` and `prebuild` run `scripts/copy-registry.mjs` to copy registry snapshots
into the public assets. A separate registry server is not required for the main
site/kit demo. Regenerate docs tables with `pnpm gen:readme` after catalog changes.

For WalletConnect, configure an application-owned project ID:

```dotenv
# apps/demo/.env.local
NEXT_PUBLIC_WC_PROJECT_ID=YOUR_PROJECT_ID
```

`src/lib/walletconnect-demo.ts` has a shared local-development fallback. Production
integrators should use their own project ID and allowed origins. The React modal
renders the pairing QR/deep link; application code does not render its own QR.
The WalletConnect compatibility runtime loads at connection time.

Hosted wallets need their own login and approval. A local page or passing automated
mock test does not establish vendor production-origin authorization or a ledger result.

## Documentation workflow

The site uses task-oriented pages in `src/app/docs/<slug>/content.tsx`. Repository
versions live in `docs/`. Keep shared guide headings and examples aligned; English
is canonical. The quick start and README install commands must match the public kit.

```bash
pnpm gate:docs-drift
pnpm gate:readme
pnpm --filter partylayer-demo typecheck
pnpm --filter partylayer-demo lint
pnpm --filter partylayer-demo build
```

Before a coordinated package release, review candidate-version notes and ensure the
website, README files, starters and published npm versions tell the same story.

## Browser acceptance

```bash
pnpm --filter partylayer-demo exec playwright install chromium
CI=true pnpm --filter partylayer-demo test:e2e:pr
```

The PR suite covers smoke, controlled connection, Vala beta, keyboard and axe checks.
Real assistive-technology speech, vendor approvals and send/swap settlement require
separate evidence. See [wallet acceptance](../../docs/wallet-acceptance.md).

## License

MIT
