---
"@partylayer/sdk": minor
---

listWallets now hides a registry wallet whose adapter is not registered, unless the wallet is announce transport (Console, Send). This generalizes the existing discovery-adapter gating to every transport that needs an app-registered adapter: a wallet that ships a PartyLayer adapter package (Loop, Cantor8, Nightly, Bron, WalletConnect), or a discovery-adapter popup/remote wallet whose official ProviderAdapter the app supplies. It matches the library default (RainbowKit): a wallet the app cannot actually connect is not shown, because clicking it could only fail. Announce wallets stay visible with no app adapter, because the SDK drives them from the registry entry and installing the extension is enough. The classification is read from each entry's declared transport, never a hardcoded list.

Impact: an app that registers the default builtin adapters (Loop, Cantor8, Nightly) alongside Console and Send over announce sees the same picker as before, except Bron and WalletConnect are now hidden until their adapters are registered (they require an OAuth configuration and a WalletConnect project id respectively). Register an adapter to surface its wallet.
