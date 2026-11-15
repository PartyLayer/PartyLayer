---
"@partylayer/react-native": major
"@partylayer/sdk": patch
---

Bundle PartyLayer's own native client implementation into React Native so native installations no longer pull the browser SDK or wallet vendor dependency graph. Keep AsyncStorage 2.x supported, expose the bundled constructor, and accept external SDK clients through a structural public client interface. Preserve React Native Web's browser factory through the browser export condition and explicit `/web` entry with an optional SDK peer; web applications install the SDK explicitly. Separate shared SDK configuration types from browser-only wallet configuration so native declarations remain self-contained.
