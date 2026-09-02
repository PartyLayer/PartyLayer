---
"@partylayer/adapter-console": minor
"@partylayer/adapter-nightly": minor
"@partylayer/adapter-loop": minor
"@partylayer/adapter-walletconnect": minor
---

Stop returning invented values when the wallet reports none. Adapters now fail instead.

**Read this before upgrading: calls that previously succeeded with a fabricated value now throw.** In every case the value they returned was manufactured, so code that relied on it was relying on something that never came from the wallet. Nothing that returned a real value changes.

Seven sites across four adapters manufactured data to fill required fields:

| | Was | Now |
|---|---|---|
| `ConsoleAdapter.connect` | `party-<now>` when the wallet returned no party id | throws |
| `ConsoleAdapter.signTransaction` | `tx_<now>_<random>` **on every call**, whatever the wallet returned | the wallet's signature, or throws |
| `ConsoleAdapter.submitTransaction` | `tx_<now>` when no signature came back | the wallet's signature, or throws |
| `NightlyAdapter.submitTransaction` | `tx_<now>_<random>` when neither updateId nor signature came back | throws; `updateId` now reported when real |
| `LoopAdapter.submitTransaction` | `updateId: submission_id ?? command_id` | reads the SDK's real `update_id`, and **omits** the field when absent |
| `WalletConnectAdapter.submitTransaction` | the literal string `'pending'` as a `transactionHash` | throws, matching the Send adapter |

Two were not fallbacks at all: `ConsoleAdapter.signTransaction` generated a hash on every successful call, and `LoopAdapter` reported a submission id as an update id unconditionally. Both were wrong on the happy path. Every one of these is our own adapter code, not the wallet's.

**The `ConsoleAdapter` party id is the one to look at first.** A session carrying a fabricated party is not degraded, it is broken — every later call acts as a party that does not exist, and the failure surfaces far from its cause. It now fails at connect.

**The Loop adapter now reports a real update id.** `RunTransactionResponse.update_id` was always in the Loop SDK's response and our adapter never read it, reaching for `submission_id` instead. A submission id identifies the request, not the committed update. Where no update id exists the field is now omitted rather than substituted, so a caller can tell "no update id" from "here is one".

**What this does not fix.** `TxReceipt.transactionHash` and `SignedTransaction.transactionHash` are required fields, so an adapter with no hash to give has nowhere to put nothing. `ConsoleAdapter` still reports a signature and `LoopAdapter` a command id under that name — real values the wallets issued, but not transaction hashes. Correcting the label means making those fields optional, which is a published-interface change and its own decision. What these adapters no longer do is invent the value.
