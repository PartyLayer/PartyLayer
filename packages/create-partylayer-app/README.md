# create-partylayer-app

Create a Canton dApp with PartyLayer wallet connectivity, configuration and a working development setup. React starters use the ready-made `ConnectButton` and show **Powered by PartyLayer** by default.

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

Node.js 18 is the CLI minimum. Follow the generated framework's Node requirements as well; use a supported Node LTS release for new projects.

## Next steps

- [Quick start](https://partylayer.xyz/docs/quick-start)
- [Wallet configuration](https://partylayer.xyz/docs/partylayer-kit)
- [Authentication](https://partylayer.xyz/docs/authentication)
- [Transaction lifecycle](https://partylayer.xyz/docs/transaction-lifecycle)

## License

MIT
