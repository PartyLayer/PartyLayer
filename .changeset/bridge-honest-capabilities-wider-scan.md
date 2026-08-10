---
"@partylayer/sdk": patch
---

Report the signMessage capability from the announce entry's declared capabilities rather than a fixed baseline, so a wallet that cannot sign is not advertised as able to. Also widen the injected discovery scan to the window globals that announce-transport registry entries declare, so a wallet at its own dedicated global is found generically. Both are additive and change no behavior for any wallet currently in the registry.
