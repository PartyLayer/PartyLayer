---
"@partylayer/react-native": minor
---

Add the React Native connect UI (phase B2), behind a new "./ui" subpath so the headless
"." entrypoint stays free of the SVG renderer.

Components: ConnectButton (a Pressable reflecting the connect state, using the theme
pressed color), WalletList (the connect modal over a FlatList with the core flow states:
list, connecting and cancellable, error with retry, and dismiss on connect), WalletIcon,
and the core chrome icons (close, back, error, spinner). Wallet logos are always real,
never letters: PNG and JPG through Image, SVG through react-native-svg's SvgUri, and a
neutral glyph fallback for an unknown format or a load failure.

react-native-svg is declared as an OPTIONAL peer dependency, required in practice only
for the ui entrypoint; the headless entrypoint never imports it, and the ui entrypoint
throws a clear error when it is missing. On mobile the deep link transport opens the
wallet app directly, so there is no QR screen to port from the web modal.

Also ports the seven accent presets and the accent override capability into the RN theme
(applyAccent, accentPresets), matching the web theme, and adds a drift test that fails
when the copied theme data diverges from packages/react/src/theme.tsx.
