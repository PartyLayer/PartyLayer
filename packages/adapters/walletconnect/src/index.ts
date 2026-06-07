/**
 * @partylayer/adapter-walletconnect
 *
 * Opt-in WalletConnect adapter for PartyLayer. Wraps the official
 * `@canton-network/dapp-sdk` `WalletConnectAdapter` so dApps can connect Canton
 * wallets over WalletConnect (hosted/mobile wallets, e.g. Nightly mobile).
 *
 * Importing THIS entry module does NOT pull `@canton-network/dapp-sdk` or
 * `@walletconnect/sign-client` — the dapp-sdk barrel is loaded via dynamic
 * `import()` only when `connect()`/`restore()` runs. Enable by registering the
 * adapter via `config.adapters` and installing the optional `@walletconnect/*`
 * peers.
 */

export { WalletConnectAdapter } from './walletconnect-adapter';
export type {
  WalletConnectAdapterConfig,
  WalletConnectAdapterOptions,
  SignInWithCantonParams,
} from './walletconnect-adapter';
