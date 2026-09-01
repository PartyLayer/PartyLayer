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
| Console `connect` | `party-<now>` when the wallet reported no party id | throws |
| Console `signTransaction` | `tx_<now>_<random>` **on every call**, whatever the wallet returned | the wallet's signature, or throws |
| Console `submitTransaction` | `tx_<now>` when no signature came back | the wallet's signature, or throws |
| Nightly `submitTransaction` | `tx_<now>_<random>` when neither updateId nor signature came back | throws; `updateId` now reported when real |
| Loop `submitTransaction` | `updateId: submission_id ?? command_id` | reads the SDK's real `update_id`, and **omits** the field when absent |
| WalletConnect `submitTransaction` | the literal string `'pending'` as a `transactionHash` | throws, matching the Send adapter |

Two were not fallbacks at all: Console's `signTransaction` generated a hash on every successful call, and Loop reported a submission id as an update id unconditionally. Both were wrong on the happy path.

**The Console party id is the one to look at first.** A session carrying a fabricated party is not degraded, it is broken — every later call acts as a party that does not exist, and the failure surfaces far from its cause. It now fails at connect.

**Loop gains a real update id.** `RunTransactionResponse.update_id` was always in the SDK response and never read; the adapter reached for `submission_id` instead. A submission id identifies the request, not the committed update. Where no update id exists the field is now omitted rather than substituted, so a caller can tell "no update id" from "here is one".

**What this does not fix.** `TxReceipt.transactionHash` and `SignedTransaction.transactionHash` are required fields, so an adapter with no hash to give has nowhere to put nothing. Console still reports a signature and Loop a command id under that name — real values the wallet issued, but not transaction hashes. Correcting the label means making those fields optional, which is a published-interface change and its own decision. What these adapters no longer do is invent the value.
