---
"@partylayer/react-native": minor
---

Add the React Native theme bridge and headless hooks (phase B1). No visual components.

Theme bridge: convert a PartyLayerTheme into a React Native ready object. Colors pass
through verbatim (React Native accepts hex and rgba). Three fields are adapted:
borderRadius is parsed from a CSS length into a number (px and rem with a 16px rem
base, falling back to 10), overlayBlur is dropped in favor of an opaque overlay color
derived from colors.overlay, and primaryHover is exposed as a pressed color for
Pressable states. The six theme families are copied into the package as pure data,
because the react theme module is only reachable through a DOM bound entrypoint.

Headless hooks built on the phase A client: useWallets loads the registry list with
loading, success, and error states and exposes per wallet icon data (URL plus a format
hint of svg, png, jpg, or unknown), and useConnect connects, disconnects, tracks the
current session, and surfaces status and errors. They consume the sdk and reuse its
registry logic; the client is passed explicitly so the package stays headless.
