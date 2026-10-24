# {{PROJECT_NAME}}

A Canton dApp using Next.js App Router, PartyLayer's default `ConnectButton` and
explicit cookie-based UI session hints. The connection modal shows **Powered by
PartyLayer** by default.

## Develop

The CLI installs dependencies unless `--no-install` was selected. If installation
was skipped, run `npm install` first.

```bash
npm run dev
```

## Application structure

- `app/providers.tsx` is the client boundary. It mounts `QueryClientProvider` and
  `PartyLayerKit` and supplies stable cookie storage through `sessionOptions`.
- `lib/session.ts` reads the same UI cookie on the server through a Next.js cookie
  adapter. This can render an initial account hint without waiting for browser storage.
- The default button reads the live session after hydration; wallet restoration still
  requires the SDK's live identity/network checks.

**The UI cookie is not authentication or authorization.** Do not protect backend data
or actions with its party ID. For protected server routes, use a backend challenge,
independent signature/key verification and a server-managed authenticated session.

## Wallet configuration

Change `network` in `app/providers.tsx`; keep the application name and any server-side
network assumptions aligned. The default is Devnet. Runtime dependencies are included;
no per-wallet installation or registration is needed.

- Vala: Devnet with `channel="beta"` on `PartyLayerKit`.
- Send: Mainnet-only in the catalog.
- WalletConnect: your project ID through a stable `walletConnect` configuration.
- Bron: your OAuth/API configuration through `bron`.
- `additionalAdapters` extends the defaults; `adapters` replaces them.

User login/approval and test funding are separate prerequisites. A connection or
signature does not verify a send/swap outcome.

## Build

```bash
npm run build
npm start
```

## Documentation

- [Quick start](https://partylayer.xyz/docs/quick-start)
- [Kit configuration](https://partylayer.xyz/docs/partylayer-kit)
- [Authentication](https://partylayer.xyz/docs/authentication)
- [Transaction lifecycle](https://partylayer.xyz/docs/transaction-lifecycle)
