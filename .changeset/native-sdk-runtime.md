---
"@partylayer/sdk": patch
"@partylayer/react-native": patch
---

Add a native-safe SDK entry sharing the existing client implementation and use it from React Native. Native clients load only application-supplied compatible transports, disable browser discovery, and reject automatic browser-only wallet configuration with actionable guidance. Preserve the browser default wallet catalog. Declare the Buffer runtime dependency required by the native SVG UI so standard Metro builds resolve without global shims.
