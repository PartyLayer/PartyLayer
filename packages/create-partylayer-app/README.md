# create-partylayer-app

Create a Canton dApp with PartyLayer wallet connectivity, configuration and a working development setup. React starters use the ready-made `ConnectButton` and show **Powered by PartyLayer** by default.

Use a supported Node LTS release. CLI 0.7.0 requires Node **20.12.0+**, matching its existing prompt-library dependency; your selected framework may require a newer runtime.

## Create an app

```bash
npm create partylayer-app@latest my-dapp -- --template react-vite --pm npm
```

The CLI creates the directory and installs dependencies. Then:

```bash
cd my-dapp
npm run dev
```

For an interactive setup, run `npm create partylayer-app@latest` and choose a directory, template and package manager. pnpm and Yarn are also supported.

> This guide covers CLI **0.6.0+** and its coordinated wallet-kit templates. See [release validation](https://github.com/PartyLayer/PartyLayer/blob/main/docs/releasing.md#default-wallet-release-validation) for release status.

## Templates

| Template | Use it for |
| --- | --- |
| `react-vite` | React + Vite with `PartyLayerKit` and the default `ConnectButton` |
| `next-ssr` | Next.js App Router with a client provider boundary and a cookie-based UI session projection |
| `vue-nuxt-pinia` | Nuxt + Vue + Pinia with a custom connection UI and PartyLayer attribution |
| `vanilla` | TypeScript + Vite with the SDK and a custom connection UI |
| `react-tokenization` | Tokenization UI over an application-owned demo backend |
| `react-dvp` | Delivery-versus-payment UI over an application-owned demo backend |

The vertical templates start with in-memory demo backends. Real ledger mode needs application-owned fetchers and authorization; scaffolding does not deploy a ledger backend. SSR cookies are UI hints, not an authenticated server session. Use backend verification for protected routes.

## Existing React application

You can add the kit without creating a new app:

```bash
npm install @partylayer/react @tanstack/react-query
```

```tsx
import { PartyLayerKit, ConnectButton } from '@partylayer/react';

<PartyLayerKit network="devnet" appName="My dApp">
  <ConnectButton />
</PartyLayerKit>
```

Reviewed wallet runtimes come with the kit. Network/channel selection and wallet capabilities control availability. Vala requires Devnet with `channel="beta"`; Send is Mainnet-only in the catalog. WalletConnect requires your project ID and Bron requires OAuth/API configuration. No additional per-wallet package installation is required.

## CLI options

| Flag | Description |
| --- | --- |
| `<dir>` | Target directory; an existing directory must be empty |
| `-t, --template <id>` | One of the template IDs above |
| `--pm <manager>` | `npm`, `pnpm` or `yarn` |
| `--no-install` | Generate files without installing dependencies |
| `--no-git` | Skip Git initialization |
| `-h, --help` | Print help |

Provide directory, template and package manager to skip prompts. For example:

```bash
npm create partylayer-app@latest my-dapp -- --template next-ssr --pm npm --no-git
```

CLI 0.7.0 requires Node.js 20.12.0 or newer. Follow the generated framework's Node requirements as well; use a supported Node LTS release for new projects.

## Recover an installation failure

If dependency installation fails, keep the generated project and resolve the package
manager's reported network, registry or dependency issue. Retry with the selected
package manager before starting the app:

```bash
cd my-dapp
npm install
npm run dev
```

Use `pnpm` or `yarn` in place of `npm` if selected during setup. With `--no-install`,
installation is deliberately left to you. A generated directory alone does not mean
its dependencies are ready or that a live wallet connection has succeeded.

## Next steps

- [Quick start](https://partylayer.xyz/docs/quick-start)
- [Wallet configuration](https://partylayer.xyz/docs/partylayer-kit)
- [Authentication](https://partylayer.xyz/docs/authentication)
- [Transaction lifecycle](https://partylayer.xyz/docs/transaction-lifecycle)

## License

MIT

## Diagnose an existing application

**Available in CLI 0.7.0 and newer.** CLI 0.6.2 and older do not support `--doctor`.

```bash
npx create-partylayer-app@latest --doctor .
npx create-partylayer-app@latest --doctor ./apps/web --json
```

Select the application's directory, not just the monorepo root. Doctor reads package metadata and checks declared/installed PartyLayer entry packages, SemVer ranges, required peers, duplicate React/query contexts, Node engine requirements and competing local lockfiles. Linked/workspace dependencies are supported; non-SemVer specifications produce a warning when they cannot be compared offline. A workspace root may own the lockfile.

The command does not write project files, run application code or install scripts, read `.env`/`.npmrc`, access wallets, or contact the registry. `npx` itself may download the CLI from npm before Doctor starts. Warnings about old guide baselines do not mean an installed wallet is broken, and the offline report does not claim packages match npm's current `latest` tag.

Exit codes: **0** = no detected setup errors (warnings may exist), **1** = setup errors, **2** = invalid diagnostic arguments. `--json` emits a versioned report with `schemaVersion`, `toolVersion`, `checks` and `summary`. Do not combine Doctor with scaffold flags. The positional directory name `doctor` remains a valid scaffold target; diagnostics use the explicit `--doctor` flag.

Doctor does not prove provider mounting, application configuration, CIP-0103 transport behavior, login, signing, or successful ledger execution. Follow the [migration guide](../../docs/migration.md) and complete runtime acceptance for the application's actual wallet/network.
