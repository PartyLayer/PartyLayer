# CantonConnect Demo App

A Next.js demo application showcasing the CantonConnect SDK integration.

## Features

- Wallet connection via `WalletModal`
- Session management (connect/disconnect)
- Message signing demo
- Registry status display
- Event logging on debug page

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
│       ├── page.tsx          # Main page with CantonConnect setup
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
