---
"@partylayer/react-native": major
---

Add the provider pattern, session and transaction hooks, a theme provider, and a complete connect modal.

New: `PartyLayerProvider` holds the client, the sdk session, the wallet list and the shared session store. `useAccount`, `useSession` and `useAccountEffect` read that store; they require the provider. `useDisconnect`, `useSignMessage`, `useSignTransaction`, `useSubmitTransaction` and `useLedgerApi` take the client from the provider or from an explicit argument. `ThemeProvider` and `useTheme` supply a theme to components; `useTheme` falls back to the default light theme rather than throwing when there is no provider. `ConnectModal` runs the whole connect flow and takes no props but its visibility when the providers are present.

The transaction hooks add no capability checking of their own: the sdk client guards each method and throws `CapabilityNotSupportedError`, which passes through unchanged, so a wallet that does not advertise a capability produces the same typed error the web path produces.

`ConnectModal` drops its slide animation when the OS reduce motion setting is on, marks the sheet as a modal for screen readers with a polite live region for state changes, and takes an optional `insets` prop for safe areas. `WalletList` delegates to it, so existing callers get the same behavior.

Documented and made fixable: on React Native the shared session store falls back to in-memory storage, because the default needs IndexedDB, so a session does not survive an app restart. Passing `asyncStorage` to `PartyLayerProvider` persists it.

No new runtime or peer dependency.

Not a breaking change for a 0.2.2 consumer despite the major: every 0.2.2 export is still exported with the same behavior, `useConnect(client)` and `useWallets(client, parameters)` still work with no provider, and the `client` and `theme` props on the components are now optional rather than removed. The major reflects the size of the new surface, not a removal. Two behavior notes: the connecting state now reads "Waiting for the wallet to respond..." instead of claiming the wallet app is being opened, and a hook given a new client identity resets its state, so a client constructed inside a component body should move to module scope or a `useMemo`.
