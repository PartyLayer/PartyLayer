# PartyLayer Demo App

A Next.js demo application showcasing the PartyLayer SDK integration.

## Features

- Wallet connection via `WalletModal`
- Session management (connect/disconnect)
- Message signing demo
- Registry status display
- Event logging on debug page
- **WalletConnect** (opt-in) — connect Canton wallets over WalletConnect (e.g.
  Nightly mobile) by scanning a QR

## WalletConnect (live mobile-wallet scan)

The demo registers the opt-in `@partylayer/adapter-walletconnect`, so
**"WalletConnect"** appears in the connect modal. Clicking it shows a scannable
pairing QR + mobile deep-link **rendered by the `@partylayer/react` modal
itself** (from the adapter's `onDisplayUri`) — the demo does no QR/URI rendering
of its own.

Set a WalletConnect Cloud project id (falls back to a shared local-dev id):

```bash
# apps/demo/.env.local
NEXT_PUBLIC_WC_PROJECT_ID=577414f6b46f09a7383d3c306c013a57
```

To run the live scan test locally:

```bash
pnpm install
pnpm -r --filter "@partylayer/*" build      # build the workspace packages
cd apps/demo && NEXT_PUBLIC_WC_PROJECT_ID=577414f6b46f09a7383d3c306c013a57 pnpm dev
# open http://localhost:3000 → Connect → WalletConnect → scan the QR with a
# Canton WC wallet (e.g. Nightly mobile) → approve.
```

The WalletConnect adapter loads `@canton-network/dapp-sdk` only at connect time
(dynamic import), so registering it does not pull `@walletconnect/sign-client`
into the demo's main bundle.

## Quick Start

### Prerequisites

1. **Node.js 18+** and **pnpm 8+** installed
2. Registry server running (optional - will use fallback if unavailable)

### Installation

From the root of the wallet-sdk repository:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the demo
pnpm dev
```

### Environment Variables

Create a `.env.local` file or set these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_REGISTRY_URL` | Registry server URL | `http://localhost:3001` |
| `NEXT_PUBLIC_REGISTRY_CHANNEL` | Registry channel (`stable` or `beta`) | `stable` |
| `NEXT_PUBLIC_NETWORK` | Network (`devnet`, `testnet`, `mainnet`) | `devnet` |

### Running with Registry Server

To run with a local registry server:

```bash
# Terminal 1: Start registry server
pnpm --filter registry-server dev

# Terminal 2: Start demo app
pnpm --filter demo dev
```

## Pages

- `/` - Main demo page with wallet connection
- `/debug` - Debug page showing registry status and event log

## Supported Wallets

| Wallet | Type | Status |
|--------|------|--------|
| Console Wallet | Browser Extension | Ready |
| 5N Loop | QR Code / Popup | Ready |
| Cantor8 (C8) | Browser Extension | Ready |
| Bron | OAuth / Redirect | Ready |

## E2E Tests

Run end-to-end tests with Playwright:

```bash
pnpm --filter demo test:e2e
```

## Project Structure

```
apps/demo/
├── src/
│   └── app/
│       ├── page.tsx          # Main page with PartyLayer setup
│       ├── components/
│       │   └── DemoApp.tsx   # Demo UI component
│       ├── debug/
│       │   └── page.tsx      # Debug page
│       ├── layout.tsx        # Root layout
│       └── globals.css       # Global styles
├── e2e/                      # Playwright E2E tests
├── package.json
└── next.config.js
```

## License

MIT
