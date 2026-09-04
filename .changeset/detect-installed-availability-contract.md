---
'@partylayer/core': minor
'@partylayer/sdk': minor
'@partylayer/react': minor
'@partylayer/adapter-loop': minor
'@partylayer/adapter-cantor8': minor
'@partylayer/adapter-bron': minor
'@partylayer/adapter-walletconnect': minor
'@partylayer/adapter-console': patch
'@partylayer/adapter-nightly': patch
'@partylayer/adapter-send': patch
---

Stop reporting wallets as installed when nothing was installed.

`detectInstalled()` could only answer yes or no, and eight of twelve adapters had
no honest way to answer it — a QR wallet, a hosted popup, a relay and an OAuth
service have no local artefact to probe. They answered `true`, meaning
"reachable", and the picker read it as "installed". Cantor8 is not an extension
at all: its tile said installed, and clicking it opened a tab.

`AdapterDetectResult` gains `availability`, which says what presence actually is:
`installed`, `not-installed` (probed and absent, with an install URL),
`no-local-install` (QR / popup / relay — nothing to probe), or `unknown` (the
probe failed or timed out, which is not proof of absence). `installed` is
deprecated in its JSDoc, still populated, and exactly
`availability.kind === 'installed'`, so no consumer breaks.

**The false `true` was load-bearing.** `installGuard` read `installed` and threw
`WalletNotInstalledError` on false — so returning the truth would have blocked
connect for every wallet that has nothing to install. Making the adapters honest
broke connect for all of them until the guard was changed to ask its real
question: not "is it installed" but "do we already know this cannot work", which
only `not-installed` answers yes to. That coupling is why this is one contract
change rather than eight independent bug fixes.

Vendor `detect()` is no longer called for `discovery-adapter` wallets. All three
implementations are constants (`walley`: `window.open` exists; `cauri`:
`Promise.resolve(true)`; `oneswap`: `typeof window !== 'undefined'`), so awaiting
them bought no information while adding an async hop to the picker's render path
and a dependency on three third parties answering honestly. A `discovery-adapter`
transport IS the answer; the rule is applied in exactly one place.

The picker's subtitles for the two wallets measured causing real harm now say
what a click will do: "Scan to connect — nothing to install" and "Opens in a
popup — nothing to install".

`docs/adapters.md` records which adapters probe what, and one mismatch still
outstanding: Cantor8 classifies as `scan` but opens a tab, a registry-data fix
queued with the D5/D6 registry work.
